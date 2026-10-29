import type { SourceSnapshot } from "../domain/contracts";
const DB = "federated-architecture-analysis";
function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("items");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function load<T>(key: string): Promise<T | undefined> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const t = db.transaction("items"),
        r = t.objectStore("items").get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}
export async function save(key: string, value: unknown) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction("items", "readwrite");
      t.objectStore("items").put(value, key);
      t.oncomplete = () => resolve();
      t.onabort = t.onerror = () =>
        reject(t.error ?? Error("Lagringen misslyckades."));
    });
  } finally {
    db.close();
  }
}
export async function publishSnapshot(s: SourceSnapshot) {
  await save("snapshot:" + s.sourceId, s);
}
