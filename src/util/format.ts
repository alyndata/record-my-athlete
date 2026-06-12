/** Format milliseconds as m:ss (or h:mm:ss for long videos). */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

/** Format an ISO date (yyyy-mm-dd) as a friendly label. */
export function formatGameDate(iso: string): string {
  // Parse as local date to avoid timezone shifting the day.
  const [y, m, d] = iso.split('-').map((p) => parseInt(p, 10));
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Today's date as yyyy-mm-dd in local time. */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Format a percentage given made / attempts. */
export function pct(made: number, attempts: number): string {
  if (attempts <= 0) return '—';
  return `${Math.round((made / attempts) * 100)}%`;
}
