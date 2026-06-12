import { StatType } from '../store/types';
import { colors } from '../theme';

export interface ShotKind {
  key: 'ft' | 'fg2' | 'fg3';
  label: string;
  short: string;
  points: number;
  madeType: StatType;
  missedType: StatType;
}

/** The shot types tracked live during a game. */
export const SHOT_KINDS: ShotKind[] = [
  { key: 'ft', label: 'Free Throw', short: 'FT', points: 1, madeType: 'ft_made', missedType: 'ft_missed' },
  { key: 'fg2', label: '2-Pointer', short: '2PT', points: 2, madeType: 'fg2_made', missedType: 'fg2_missed' },
  { key: 'fg3', label: '3-Pointer', short: '3PT', points: 3, madeType: 'fg3_made', missedType: 'fg3_missed' },
];

export const MADE_TYPES: StatType[] = ['ft_made', 'fg2_made', 'fg3_made'];

/** Single-tap counter stats (not make/miss shots). */
export interface CounterStat {
  type: StatType;
  label: string;
  short: string;
}

export const COUNTER_STATS: CounterStat[] = [
  { type: 'rebound', label: 'Rebound', short: 'REB' },
  { type: 'assist', label: 'Assist', short: 'AST' },
];

const POINTS_BY_TYPE: Record<StatType, number> = {
  ft_made: 1,
  ft_missed: 0,
  fg2_made: 2,
  fg2_missed: 0,
  fg3_made: 3,
  fg3_missed: 0,
  rebound: 0,
  assist: 0,
};

export function pointsForType(type: StatType): number {
  return POINTS_BY_TYPE[type];
}

export function isMade(type: StatType): boolean {
  return MADE_TYPES.includes(type);
}

const LABELS: Record<StatType, string> = {
  ft_made: 'Made Free Throw',
  ft_missed: 'Missed Free Throw',
  fg2_made: 'Made 2-Pointer',
  fg2_missed: 'Missed 2-Pointer',
  fg3_made: 'Made 3-Pointer',
  fg3_missed: 'Missed 3-Pointer',
  rebound: 'Rebound',
  assist: 'Assist',
};

export function labelForType(type: StatType): string {
  return LABELS[type];
}

export function colorForType(type: StatType): string {
  return isMade(type) ? colors.success : colors.danger;
}
