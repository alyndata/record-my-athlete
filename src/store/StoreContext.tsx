import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { loadData, saveData } from './db';
import {
  AppData,
  Athlete,
  Clip,
  EMPTY_DATA,
  Game,
  Settings,
  StatEvent,
  Video,
} from './types';
import { uid } from '../util/id';

interface StoreContextValue {
  ready: boolean;
  data: AppData;

  // Athletes
  addAthlete: (input: { name: string; jersey?: string }) => Athlete;
  updateAthlete: (id: string, patch: Partial<Omit<Athlete, 'id'>>) => void;
  deleteAthlete: (id: string) => void;

  // Games
  addGame: (input: Omit<Game, 'id' | 'createdAt'>) => Game;
  updateGame: (id: string, patch: Partial<Omit<Game, 'id'>>) => void;
  deleteGame: (id: string) => void;

  // Videos
  addVideo: (input: Omit<Video, 'id' | 'createdAt'>) => Video;
  deleteVideo: (id: string) => void;

  // Stat events
  addStatEvent: (input: Omit<StatEvent, 'id' | 'createdAt'>) => StatEvent;
  deleteStatEvent: (id: string) => void;

  // Clips
  addClip: (input: Omit<Clip, 'id' | 'createdAt' | 'watched'> & { watched?: boolean }) => Clip;
  updateClip: (id: string, patch: Partial<Omit<Clip, 'id'>>) => void;
  deleteClip: (id: string) => void;

  // Settings
  updateSettings: (patch: Partial<Settings>) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [ready, setReady] = useState(false);
  // Keep a ref so we always persist the freshest value.
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    let mounted = true;
    loadData().then((loaded) => {
      if (!mounted) return;
      setData(loaded);
      setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  /** Apply a pure update and persist the result. */
  const mutate = useCallback((updater: (prev: AppData) => AppData) => {
    setData((prev) => {
      const next = updater(prev);
      dataRef.current = next;
      // Fire and forget; persistence errors are logged in db.ts.
      void saveData(next);
      return next;
    });
  }, []);

  const value = useMemo<StoreContextValue>(() => {
    return {
      ready,
      data,

      addAthlete: ({ name, jersey }) => {
        const athlete: Athlete = { id: uid('ath_'), name, jersey, createdAt: Date.now() };
        mutate((prev) => ({ ...prev, athletes: [...prev.athletes, athlete] }));
        return athlete;
      },
      updateAthlete: (id, patch) =>
        mutate((prev) => ({
          ...prev,
          athletes: prev.athletes.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),
      deleteAthlete: (id) =>
        mutate((prev) => {
          const gameIds = new Set(prev.games.filter((g) => g.athleteId === id).map((g) => g.id));
          return {
            ...prev,
            athletes: prev.athletes.filter((a) => a.id !== id),
            games: prev.games.filter((g) => g.athleteId !== id),
            videos: prev.videos.filter((v) => !gameIds.has(v.gameId)),
            statEvents: prev.statEvents.filter((e) => !gameIds.has(e.gameId)),
            clips: prev.clips.filter((c) => !gameIds.has(c.gameId)),
          };
        }),

      addGame: (input) => {
        const game: Game = { ...input, id: uid('game_'), createdAt: Date.now() };
        mutate((prev) => ({ ...prev, games: [...prev.games, game] }));
        return game;
      },
      updateGame: (id, patch) =>
        mutate((prev) => ({
          ...prev,
          games: prev.games.map((g) => (g.id === id ? { ...g, ...patch } : g)),
        })),
      deleteGame: (id) =>
        mutate((prev) => ({
          ...prev,
          games: prev.games.filter((g) => g.id !== id),
          videos: prev.videos.filter((v) => v.gameId !== id),
          statEvents: prev.statEvents.filter((e) => e.gameId !== id),
          clips: prev.clips.filter((c) => c.gameId !== id),
        })),

      addVideo: (input) => {
        const video: Video = { ...input, id: uid('vid_'), createdAt: Date.now() };
        mutate((prev) => ({ ...prev, videos: [...prev.videos, video] }));
        return video;
      },
      deleteVideo: (id) =>
        mutate((prev) => ({
          ...prev,
          videos: prev.videos.filter((v) => v.id !== id),
          statEvents: prev.statEvents.filter((e) => e.videoId !== id),
          clips: prev.clips.filter((c) => c.videoId !== id),
        })),

      addStatEvent: (input) => {
        const event: StatEvent = { ...input, id: uid('ev_'), createdAt: Date.now() };
        mutate((prev) => ({ ...prev, statEvents: [...prev.statEvents, event] }));
        return event;
      },
      deleteStatEvent: (id) =>
        mutate((prev) => ({
          ...prev,
          statEvents: prev.statEvents.filter((e) => e.id !== id),
        })),

      addClip: (input) => {
        const clip: Clip = {
          watched: false,
          ...input,
          id: uid('clip_'),
          createdAt: Date.now(),
        };
        mutate((prev) => ({ ...prev, clips: [...prev.clips, clip] }));
        return clip;
      },
      updateClip: (id, patch) =>
        mutate((prev) => ({
          ...prev,
          clips: prev.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      deleteClip: (id) =>
        mutate((prev) => ({ ...prev, clips: prev.clips.filter((c) => c.id !== id) })),

      updateSettings: (patch) =>
        mutate((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } })),
    };
  }, [data, ready, mutate]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within a StoreProvider');
  return ctx;
}
