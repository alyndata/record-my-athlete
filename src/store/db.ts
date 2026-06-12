import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppData, DEFAULT_SETTINGS, EMPTY_DATA } from './types';

const STORAGE_KEY = 'rma:data:v1';

/** Load all app data from disk, falling back to empty data. */
export async function loadData(): Promise<AppData> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_DATA };
    const parsed = JSON.parse(raw) as Partial<AppData>;
    // Merge defensively so older saved payloads still load.
    return {
      athletes: parsed.athletes ?? [],
      games: parsed.games ?? [],
      videos: parsed.videos ?? [],
      statEvents: parsed.statEvents ?? [],
      clips: parsed.clips ?? [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch (err) {
    console.warn('Failed to load data, starting fresh', err);
    return { ...EMPTY_DATA };
  }
}

/** Persist all app data to disk. */
export async function saveData(data: AppData): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to save data', err);
  }
}
