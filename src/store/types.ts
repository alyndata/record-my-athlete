// Core data model for Record My Athlete (all stored on-device).

export type StatType =
  | 'ft_made'
  | 'ft_missed'
  | 'fg2_made'
  | 'fg2_missed'
  | 'fg3_made'
  | 'fg3_missed';

export interface Athlete {
  id: string;
  name: string;
  jersey?: string;
  createdAt: number;
}

export interface Game {
  id: string;
  athleteId: string;
  opponent?: string;
  teamName?: string;
  /** ISO date string (yyyy-mm-dd) of the game. */
  date: string;
  location?: string;
  notes?: string;
  createdAt: number;
}

export type VideoSource = 'recorded' | 'imported';

export interface Video {
  id: string;
  gameId: string;
  /** Local file URI. */
  uri: string;
  durationMs: number;
  source: VideoSource;
  /** For recorded segments, the order in which they were captured. */
  segmentIndex?: number;
  createdAt: number;
}

export interface StatEvent {
  id: string;
  gameId: string;
  /** The video this happened in (if tagged live while recording). */
  videoId?: string;
  type: StatType;
  /** Elapsed time within the video when the stat was tapped. */
  videoTimeMs?: number;
  createdAt: number;
}

export interface Clip {
  id: string;
  gameId: string;
  videoId: string;
  startMs: number;
  endMs: number;
  label?: string;
  watched: boolean;
  createdAt: number;
}

export interface Settings {
  /** Seconds of video to keep before a favorite tap. */
  preBufferSec: number;
  /** Seconds of video to keep after a favorite tap. */
  postBufferSec: number;
}

export interface AppData {
  athletes: Athlete[];
  games: Game[];
  videos: Video[];
  statEvents: StatEvent[];
  clips: Clip[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  preBufferSec: 2,
  postBufferSec: 2,
};

export const EMPTY_DATA: AppData = {
  athletes: [],
  games: [],
  videos: [],
  statEvents: [],
  clips: [],
  settings: DEFAULT_SETTINGS,
};
