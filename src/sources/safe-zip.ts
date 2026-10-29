import { unzipSync } from "fflate";
export const MAX_FILE = 20 * 1024 * 1024;
export function checkedBytes(data: Uint8Array) {
  if (data.length > MAX_FILE || data.length < 22)
    throw Error("Filen är för stor eller inte en ZIP-fil (max 20 MiB).");
}
export function safeZip(
  data: Uint8Array,
  limits = {
    count: 5000,
    total: 64 * 1024 * 1024,
    entry: 16 * 1024 * 1024,
    ratio: 200,
  },
) {
  checkedBytes(data);
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength),
    u16 = (i: number) => v.getUint16(i, true),
    u32 = (i: number) => v.getUint32(i, true);
  let end = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i--)
    if (u32(i) === 0x06054b50 && i + 22 + u16(i + 20) === data.length) {
      end = i;
      break;
    }
  if (end < 0 || u16(end + 4) || u16(end + 6) || u16(end + 8) !== u16(end + 10))
    throw Error("Ogiltig eller uppdelad ZIP.");
  const count = u16(end + 10),
    start = u32(end + 16),
    size = u32(end + 12);
  if (count > limits.count || start + size !== end)
    throw Error("ZIP-inventering överskrider gränserna.");
  const entries = new Map<
    string,
    { size: number; crc: number; compressed: number }
  >();
  let pos = start,
    total = 0;
  const dec = new TextDecoder("utf-8", { fatal: true });
  for (let i = 0; i < count; i++) {
    if (pos + 46 > end || u32(pos) !== 0x02014b50)
      throw Error("Skadad ZIP-inventering.");
    const flags = u16(pos + 8),
      method = u16(pos + 10),
      crc = u32(pos + 16),
      compressed = u32(pos + 20),
      bytes = u32(pos + 24),
      nl = u16(pos + 28),
      extra = u16(pos + 30),
      comment = u16(pos + 32),
      offset = u32(pos + 42);
    if (pos + 46 + nl + extra + comment > end) throw Error("Skadad ZIP.");
    const name = dec.decode(data.subarray(pos + 46, pos + 46 + nl)),
      path = name.endsWith("/") ? name.slice(0, -1) : name;
    if (
      !path ||
      path.startsWith("/") ||
      path.includes("\\") ||
      /^[a-z]:/i.test(path) ||
      path.split("/").some((p) => !p || p === "." || p === "..") ||
      /[\x00-\x1f]/.test(name) ||
      entries.has(name) ||
      ((u32(pos + 38) >>> 16) & 0xf000) === 0xa000 ||
      flags & 1 ||
      ![0, 8].includes(method) ||
      u16(pos + 34)
    )
      throw Error("Osäker, krypterad eller duplicerad ZIP-post: " + name);
    total += bytes;
    if (
      bytes > limits.entry ||
      total > limits.total ||
      (bytes && (!compressed || bytes / compressed > limits.ratio))
    )
      throw Error("ZIP-storlek/kompressionsgrad överskrider gränsen.");
    if (
      offset + 30 > start ||
      u32(offset) !== 0x04034b50 ||
      u16(offset + 6) !== flags ||
      u16(offset + 8) !== method
    )
      throw Error("ZIP-header stämmer inte.");
    const ln = u16(offset + 26),
      le = u16(offset + 28);
    if (
      dec.decode(data.subarray(offset + 30, offset + 30 + ln)) !== name ||
      offset + 30 + ln + le + compressed > start
    )
      throw Error("ZIP-postens namn/storlek stämmer inte.");
    if (
      !(flags & 8) &&
      (u32(offset + 18) !== compressed ||
        u32(offset + 22) !== bytes ||
        u32(offset + 14) !== crc)
    )
      throw Error("ZIP-storlek/kontrollsumma stämmer inte.");
    entries.set(name, { size: bytes, crc, compressed });
    pos += 46 + nl + extra + comment;
  }
  if (pos !== end) throw Error("Oväntat ZIP-innehåll.");
  const files = unzipSync(data, {
    filter: (f) => {
      const e = entries.get(f.name);
      if (!e || e.size !== f.originalSize || e.compressed !== f.size)
        throw Error("Lokal ZIP-header stämmer inte med inventeringen.");
      return true;
    },
  });
  for (const [name, e] of entries) {
    if (
      !files[name] ||
      files[name].length !== e.size ||
      crc32(files[name]) !== e.crc
    )
      throw Error("Skadad ZIP-post: " + name);
  }
  return files;
}
function crc32(b: Uint8Array) {
  let c = 0xffffffff;
  for (const byte of b) {
    c ^= byte;
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
export async function sha256(data: Uint8Array) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new Uint8Array(data).buffer),
    ),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function readLocalFile(f: File) {
  if (f.size > MAX_FILE) throw Error("Filen är för stor (max 20 MiB).");
  return new Uint8Array(await f.arrayBuffer());
}
