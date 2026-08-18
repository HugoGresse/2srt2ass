/**
 * Parse an SRT/VTT timestamp into seconds.
 * Accepts `HH:MM:SS,mmm`, `HH:MM:SS.mmm`, `MM:SS.mmm` (VTT), 1-3 fraction
 * digits, and stray whitespace. Returns null when unparseable.
 */
export function parseTimestamp(raw: string): number | null {
  const m = raw
    .trim()
    .match(/^(?:(\d{1,3}):)?(\d{1,2}):(\d{1,2})[,.](\d{1,3})$/);
  if (!m) return null;
  const [, h, min, s, frac] = m;
  const hours = h ? Number.parseInt(h, 10) : 0;
  const minutes = Number.parseInt(min!, 10);
  const seconds = Number.parseInt(s!, 10);
  const fraction = Number.parseInt(frac!, 10) / 10 ** frac!.length;
  return hours * 3600 + minutes * 60 + seconds + fraction;
}

/** Format seconds as an ASS event timestamp: `H:MM:SS.cc` (centiseconds). */
export function formatAssTime(t: number): string {
  const clamped = Math.max(0, t);
  // Round to centiseconds first so 1.999 renders as 0:00:02.00, not 0:00:01.99.
  const totalCentis = Math.round(clamped * 100);
  const centis = totalCentis % 100;
  const totalSeconds = Math.floor(totalCentis / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  return `${hours}:${pad2(minutes)}:${pad2(seconds)}.${pad2(centis)}`;
}

/** Format seconds as an SRT timestamp: `HH:MM:SS,mmm`. */
export function formatSrtTime(t: number): string {
  const clamped = Math.max(0, t);
  const totalMillis = Math.round(clamped * 1000);
  const millis = totalMillis % 1000;
  const totalSeconds = Math.floor(totalMillis / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)},${String(millis).padStart(3, '0')}`;
}

/** Format seconds for UI display: `H:MM:SS` or `M:SS`. */
export function formatClock(t: number): string {
  const totalSeconds = Math.max(0, Math.floor(t));
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  return hours > 0
    ? `${hours}:${pad2(minutes)}:${pad2(seconds)}`
    : `${minutes}:${pad2(seconds)}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
