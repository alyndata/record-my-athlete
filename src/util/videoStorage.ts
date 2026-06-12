import * as FileSystem from 'expo-file-system';
import { uid } from './id';

const VIDEO_DIR = FileSystem.documentDirectory + 'videos/';

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(VIDEO_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(VIDEO_DIR, { intermediates: true });
  }
}

function extFromUri(uri: string): string {
  const match = /\.(\w{2,5})(?:\?|$)/.exec(uri);
  return match ? match[1] : 'mp4';
}

/**
 * Persist a recorded or imported video into the app's document directory so it
 * survives app restarts and cache clearing. Returns the new local file URI.
 */
export async function persistVideo(sourceUri: string): Promise<string> {
  await ensureDir();
  const dest = `${VIDEO_DIR}${uid('v_')}.${extFromUri(sourceUri)}`;
  try {
    await FileSystem.copyAsync({ from: sourceUri, to: dest });
    return dest;
  } catch (err) {
    console.warn('persistVideo: copy failed, using original uri', err);
    return sourceUri;
  }
}

/** Delete a stored video file (best effort). */
export async function deleteVideoFile(uri: string): Promise<void> {
  try {
    if (uri.startsWith(VIDEO_DIR)) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch (err) {
    console.warn('deleteVideoFile failed', err);
  }
}
