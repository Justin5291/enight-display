const DB = "enight-media";
const STORE = "files";
const urls = new Map();

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function requestToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putBlob(id, blob) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("aborted"));
  });
  db.close();
}

export async function getBlob(id) {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const blob = await requestToPromise(tx.objectStore(STORE).get(id));
  db.close();
  return blob || null;
}

export async function deleteBlob(id) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  const url = urls.get(id);
  if (url) URL.revokeObjectURL(url);
  urls.delete(id);
}

export async function blobUrl(id) {
  if (urls.has(id)) return urls.get(id);
  const blob = await getBlob(id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urls.set(id, url);
  return url;
}

export function kindOf(mime, name) {
  const n = String(name || "").toLowerCase().split("?")[0];
  const m = mime || "";
  if (m.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|avif|heic)$/.test(n)) return "image";
  if (m.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/.test(n)) return "video";
  if (m === "application/pdf" || /\.pdf$/.test(n)) return "pdf";
  if (/^https?:\/\//.test(name || "")) return "page";
  return "other";
}

export async function mediaSrc(item) {
  if (!item) return null;
  if (item.url) return item.url;
  return blobUrl(item.id);
}
