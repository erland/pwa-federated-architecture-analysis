import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
async function walk(dir) {
  let out = [];
  for (const f of await readdir(dir, { withFileTypes: true })) {
    const p = `${dir}/${f.name}`;
    if (f.isDirectory()) out.push(...(await walk(p)));
    else if (f.name !== "sw.js") out.push(p);
  }
  return out;
}
const files = await walk("dist");
if (
  files.some(
    (file) =>
      file.startsWith("dist/examples/") ||
      /(?:analysis-type(?:-portfolio|-process)?\.json|systemregister\.xlsx|architecture\.xml|faa-reference\.mmp\.zip)$/.test(
        file,
      ),
  )
) {
  throw new Error(
    "Source-only example files must not be shipped or precached.",
  );
}
const hash = createHash("sha256");
for (const f of files) hash.update(await readFile(f));
const version = "faa-" + hash.digest("hex").slice(0, 16);
await writeFile(
  "dist/sw.js",
  `const CACHE=${JSON.stringify(version)},FILES=${JSON.stringify(files.map((f) => "./" + f.slice(5)))};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('faa-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).catch(()=>e.request.mode==='navigate'?caches.match(new URL('./index.html',self.location).href):Response.error())))});`,
);
