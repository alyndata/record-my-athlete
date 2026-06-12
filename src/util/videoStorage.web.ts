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
async function shareBlob(blob: Blob, filename: string): Promise<void> {
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

export async function shareVideo(uri: string, filename: string): Promise<void> {
  const blob = await getBlob(uri);
  if (!blob) return;
  await shareBlob(blob, filename);
}

// --- In-browser clip trimming (ffmpeg.wasm, loaded on demand) -------------
//
// We trim the highlight out of the full recording entirely in the browser so
// nothing is uploaded anywhere. ffmpeg is loaded from a CDN the first time a
// clip is exported (a one-time download, then cached by the browser) and is
// deliberately kept out of the app bundle. The single-threaded core is used
// so it works without cross-origin isolation (which GitHub Pages can't set).
// If anything in this path fails — unsupported browser, memory, network — the
// caller falls back to sharing the full video.

const FFMPEG_ESM = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/+esm';
const FFMPEG_UTIL_ESM = 'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/+esm';
const CORE_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';

// Runtime dynamic import so the bundler never tries to resolve the CDN URL.
const dynamicImport = new Function('u', 'return import(u)') as (u: string) => Promise<any>;

let ffmpegPromise: Promise<any> | null = null;

async function loadFFmpeg(): Promise<any> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
        dynamicImport(FFMPEG_ESM),
        dynamicImport(FFMPEG_UTIL_ESM),
      ]);
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      return ffmpeg;
    })().catch((err) => {
      ffmpegPromise = null; // allow a later retry
      throw err;
    });
  }
  return ffmpegPromise;
}

/** Trim [startMs, endMs] out of a video Blob without re-encoding. */
async function trimBlob(blob: Blob, startMs: number, endMs: number): Promise<Blob> {
  const ffmpeg = await loadFFmpeg();
  const isWebm = (blob.type || '').includes('webm');
  const ext = isWebm ? 'webm' : 'mp4';
  const input = `in.${ext}`;
  const output = `out.${ext}`;
  const start = Math.max(0, startMs / 1000);
  const dur = Math.max(0.1, (endMs - startMs) / 1000);

  const buf = new Uint8Array(await blob.arrayBuffer());
  await ffmpeg.writeFile(input, buf);
  try {
    // Seek before -i and copy streams: fast, no re-encode. Cuts snap to the
    // nearest keyframe, which is fine for highlight clips.
    await ffmpeg.exec(['-ss', String(start), '-t', String(dur), '-i', input, '-c', 'copy', '-y', output]);
    const data = (await ffmpeg.readFile(output)) as Uint8Array;
    if (!data || data.length === 0) throw new Error('empty clip output');
    return new Blob([data.buffer], { type: isWebm ? 'video/webm' : 'video/mp4' });
  } finally {
    ffmpeg.deleteFile(input).catch(() => {});
    ffmpeg.deleteFile(output).catch(() => {});
  }
}

/**
 * Export a single highlight: trims [startMs, endMs] from the source video in
 * the browser, then hands the clip to the share sheet / download. Falls back
 * to sharing the full video if trimming isn't possible. Resolves to true when
 * a trimmed clip was produced, false when it fell back to the full video.
 */
export async function shareClip(
  uri: string,
  startMs: number,
  endMs: number,
  filename: string
): Promise<boolean> {
  const blob = await getBlob(uri);
  if (!blob) return false;
  try {
    const clip = await trimBlob(blob, startMs, endMs);
    await shareBlob(clip, filename);
    return true;
  } catch (err) {
    console.warn('shareClip: trimming failed, sharing full video', err);
    await shareBlob(blob, filename);
    return false;
  }
}
