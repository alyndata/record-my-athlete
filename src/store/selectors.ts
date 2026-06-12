import { useMemo } from 'react';
import { useStore } from './StoreContext';
import { computeStats, GameStats } from '../domain/stats';
import { Athlete, Clip, Game, StatEvent, Video } from './types';

export function useAthlete(id?: string): Athlete | undefined {
  const { data } = useStore();
  return useMemo(() => data.athletes.find((a) => a.id === id), [data.athletes, id]);
}

export function useGame(id?: string): Game | undefined {
  const { data } = useStore();
  return useMemo(() => data.games.find((g) => g.id === id), [data.games, id]);
}

export function useVideo(id?: string): Video | undefined {
  const { data } = useStore();
  return useMemo(() => data.videos.find((v) => v.id === id), [data.videos, id]);
}

export function useClip(id?: string): Clip | undefined {
  const { data } = useStore();
  return useMemo(() => data.clips.find((c) => c.id === id), [data.clips, id]);
}

export function useGameVideos(gameId?: string): Video[] {
  const { data } = useStore();
  return useMemo(
    () =>
      data.videos
        .filter((v) => v.gameId === gameId)
        .sort((a, b) => a.createdAt - b.createdAt),
    [data.videos, gameId],
  );
}

export function useGameClips(gameId?: string): Clip[] {
  const { data } = useStore();
  return useMemo(
    () =>
      data.clips
        .filter((c) => c.gameId === gameId)
        .sort((a, b) => a.createdAt - b.createdAt),
    [data.clips, gameId],
  );
}

export function useGameStatEvents(gameId?: string): StatEvent[] {
  const { data } = useStore();
  return useMemo(
    () => data.statEvents.filter((e) => e.gameId === gameId),
    [data.statEvents, gameId],
  );
}

export function useGameStats(gameId?: string): GameStats {
  const events = useGameStatEvents(gameId);
  return useMemo(() => computeStats(events), [events]);
}

/** Games sorted by date descending, with their athlete and quick stats. */
export function useGamesWithSummary() {
  const { data } = useStore();
  return useMemo(() => {
    return data.games
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt))
      .map((game) => {
        const athlete = data.athletes.find((a) => a.id === game.athleteId);
        const events = data.statEvents.filter((e) => e.gameId === game.id);
        const clipCount = data.clips.filter((c) => c.gameId === game.id).length;
        return { game, athlete, stats: computeStats(events), clipCount };
      });
  }, [data.games, data.athletes, data.statEvents, data.clips]);
}
