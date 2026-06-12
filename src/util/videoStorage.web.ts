// Web implementation of video storage: recorded clips are kept as Blobs in
// IndexedDB (so they survive reloads) and referenced by an `idb:<id>` URI.
import { uid } from './id';

const DB_NAME = 'rma-videos';
const STORE = 'blobs';
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

/** Store a recorded blob and return a stable `idb:<id>` URI. */
export async function putVideoBlob(blob: Blob): Promise<string> {
  const id = uid('v_');
  const db = await getDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return `idb:${id}`;
}

/** Turn an `idb:<id>` URI into a playable object URL (others pass through). */
export async function resolveVideoUri(uri: string): Promise<string> {
  if (!uri || !uri.startsWith('idb:')) return uri;
  const id = uri.slice(4);
  try {
    const db = await getDb();
    const blob = await new Promise<Blob | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const rq = tx.objectStore(STORE).get(id);
      rq.onsuccess = () => resolve(rq.result as Blob | undefined);
      rq.onerror = () => reject(rq.error);
    });
    return blob ? URL.createObjectURL(blob) : uri;
  } catch (err) {
    console.warn('resolveVideoUri failed', err);
    return uri;
  }
}

export async function deleteVideoFile(uri: string): Promise<void> {
  if (!uri || !uri.startsWith('idb:')) return;
  const id = uri.slice(4);
  try {
    const db = await getDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('deleteVideoFile (web) failed', err);
  }
}

/**
 * Persist an imported video. The picker hands us a temporary object/data URL,
 * so we read it into a Blob and store it in IndexedDB — otherwise it would
 * break on reload. Returns an `idb:<id>` URI.
 */
export async function persistVideo(sourceUri: string): Promise<string> {
  try {
    const resp = await fetch(sourceUri);
    const blob = await resp.blob();
    return await putVideoBlob(blob);
  } catch (err) {
    console.warn('persistVideo (web) failed, using source uri', err);
    return sourceUri;
  }
}

/** Read the underlying Blob for a stored or remote video URI. */
async function getBlob(uri: string): Promise<Blob | null> {
  if (!uri) return null;
  if (uri.startsWith('idb:')) {
    const id = uri.slice(4);
    try {
      const db = await getDb();
      return await new Promise<Blob | null>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const rq = tx.objectStore(STORE).get(id);
        rq.onsuccess = () => resolve((rq.result as Blob) ?? null);
        rq.onerror = () => reject(rq.error);
      });
    } catch {
      return null;
    }
  }
  try {
    const resp = await fetch(uri);
    return await resp.blob();
  } catch {
    return null;
  }
}

/**
 * Hand a video to the OS: on iOS/Android this opens the native share sheet
 * (Save to Photos / Files); elsewhere it falls back to a file download.
 */
export async function shareVideo(uri: string, filename: string): Promise<void> {
  const blob = await getBlob(uri);
  if (!blob) return;
  const type = blob.type || 'video/mp4';
  const name = type.includes('webm') ? filename.replace(/\.\w+$/, '') + '.webm' : filename;
  const file = new File([blob], name, { type });

  const nav = navigator as Navigator & {
    canShare?: (d: { files: File[] }) => boolean;
    share?: (d: { files: File[]; title?: string }) => Promise<void>;
  };
  if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return;
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // user dismissed the sheet
    }
  }

  // Fallback: trigger a download.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
