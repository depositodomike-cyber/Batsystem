// ----------------------------------------------------------------------
// Armazenamento chave-valor em IndexedDB.
//
// O localStorage tem teto de ~5 MB e poucos data-URIs já o estouram (foi o que
// fazia as imagens dos Documentos sumirem ao recarregar). O IndexedDB tem cota
// muito maior, então tudo que pode carregar binário (biblioteca de Documentos,
// documentos dos grupos com anexos do AI Studio) mora aqui.
//
// Mesmo banco/store da biblioteca de Documentos — as chaves é que separam os
// domínios.
// ----------------------------------------------------------------------

const IDB_NAME = "beculture";
const IDB_STORE = "kv";

export function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        req.result.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb open"));
  });
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await idbOpen();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const req = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error ?? new Error("idb get"));
    });
  } finally {
    db.close();
  }
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await idbOpen();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("idb set"));
      tx.onabort = () => reject(tx.error ?? new Error("idb abort"));
    });
  } finally {
    db.close();
  }
}

/** Lê um Blob como data-URI (persistível; um objectURL `blob:` morre no reload). */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("read error"));
    r.readAsDataURL(blob);
  });
}
