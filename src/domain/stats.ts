import { StatEvent } from '../store/types';

export interface ShotLine {
  made: number;
  attempts: number;
}

export interface GameStats {
  points: number;
  ft: ShotLine;
  fg2: ShotLine;
  fg3: ShotLine;
  /** Combined field goals (2PT + 3PT). */
  fg: ShotLine;
}

const emptyLine = (): ShotLine => ({ made: 0, attempts: 0 });

/** Aggregate a set of stat events into a game stat line. */
export function computeStats(events: StatEvent[]): GameStats {
  const stats: GameStats = {
    points: 0,
    ft: emptyLine(),
    fg2: emptyLine(),
    fg3: emptyLine(),
    fg: emptyLine(),
  };

  for (const ev of events) {
    switch (ev.type) {
      case 'ft_made':
        stats.ft.made++;
        stats.ft.attempts++;
        stats.points += 1;
        break;
      case 'ft_missed':
        stats.ft.attempts++;
        break;
      case 'fg2_made':
        stats.fg2.made++;
        stats.fg2.attempts++;
        stats.fg.made++;
        stats.fg.attempts++;
        stats.points += 2;
        break;
      case 'fg2_missed':
        stats.fg2.attempts++;
        stats.fg.attempts++;
        break;
      case 'fg3_made':
        stats.fg3.made++;
        stats.fg3.attempts++;
        stats.fg.made++;
        stats.fg.attempts++;
        stats.points += 3;
        break;
      case 'fg3_missed':
        stats.fg3.attempts++;
        stats.fg.attempts++;
        break;
    }
  }

  return stats;
}
