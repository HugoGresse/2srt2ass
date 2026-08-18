import type { Cue } from './types';

/**
 * Auto-synchronization, ported from 2srt2ass-cpp.
 *
 * For a candidate shift, each cue of one track is matched to the
 * nearest-starting cue of the other track (within a ±4 s window) and the
 * absolute start/end deltas are summed. The shift minimizing the symmetric
 * sum is the best alignment. The original scanned ±10 s in 10 ms steps;
 * here a coarse-then-fine scan covers ±30 s at the same final resolution
 * for a fraction of the work.
 */

const SEARCH_WINDOW = 8; // seconds, same as the original tool

export interface AutoSyncResult {
  /** Seconds to add to the "movable" track (top) for best alignment. */
  shift: number;
  /** Residual alignment distance at that shift (lower = better match). */
  distance: number;
  /** Distance at shift 0, for judging whether syncing helped. */
  baseline: number;
}

/**
 * Alignment distance between track `a` and track `b` when `b` is shifted by
 * `offsetB`. Mirrors `alignment_distance` in the C++ tool: for every cue in
 * `a`, find the nearest cue start in `b` inside the window and accumulate
 * |Δstart| + |Δend|.
 */
export function alignmentDistance(a: Cue[], b: Cue[], offsetB: number): number {
  if (a.length === 0 || b.length === 0) return 0;
  let distance = 0;
  for (const cueA of a) {
    const start = cueA.start - offsetB;
    const end = cueA.end - offsetB;

    let idx = lowerBoundByStart(b, start - SEARCH_WINDOW / 2);
    let closest = Math.min(idx, b.length - 1);
    let closestDelta = Math.abs(b[closest]!.start - start);
    while (idx < b.length) {
      const delta = Math.abs(b[idx]!.start - start);
      if (delta < closestDelta) {
        closest = idx;
        closestDelta = delta;
      }
      if (b[idx]!.start > start + SEARCH_WINDOW / 2) break;
      idx += 1;
    }

    distance += Math.abs(b[closest]!.start - start) + Math.abs(b[closest]!.end - end);
  }
  return distance;
}

/** First index whose cue start is >= `time` (cues must be sorted by start). */
function lowerBoundByStart(cues: Cue[], time: number): number {
  let lo = 0;
  let hi = cues.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid]!.start < time) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function symmetricDistance(top: Cue[], bottom: Cue[], shift: number): number {
  return (
    alignmentDistance(bottom, top, shift) + alignmentDistance(top, bottom, -shift)
  );
}

/**
 * Find the time shift for `top` that best aligns it with `bottom`.
 * Two-pass scan: coarse 100 ms steps over ±`range`, then 10 ms steps in a
 * ±200 ms neighborhood of the coarse optimum.
 */
export function autoSync(
  top: Cue[],
  bottom: Cue[],
  range = 30,
): AutoSyncResult {
  const baseline = symmetricDistance(top, bottom, 0);
  if (top.length === 0 || bottom.length === 0) {
    return { shift: 0, distance: baseline, baseline };
  }

  const coarse = scan(top, bottom, -range, range, 0.1);
  const fine = scan(top, bottom, coarse.shift - 0.2, coarse.shift + 0.2, 0.01);

  // Round away float-accumulation noise; 10 ms is the scan resolution.
  const shift = Math.round(fine.shift * 100) / 100;
  return { shift, distance: fine.distance, baseline };
}

function scan(
  top: Cue[],
  bottom: Cue[],
  from: number,
  to: number,
  step: number,
): { shift: number; distance: number } {
  let bestShift = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  const steps = Math.round((to - from) / step);
  for (let i = 0; i <= steps; i += 1) {
    const shift = from + i * step;
    const distance = symmetricDistance(top, bottom, shift);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestShift = shift;
    }
  }
  return { shift: bestShift, distance: bestDistance };
}

/**
 * Shift needed so that top cue `topIndex` starts exactly when bottom cue
 * `bottomIndex` starts — the manual "these two lines match" sync.
 * Indices are positions in the cue arrays (0-based).
 */
export function shiftFromPair(
  top: Cue[],
  bottom: Cue[],
  topIndex: number,
  bottomIndex: number,
): number | null {
  const topCue = top[topIndex];
  const bottomCue = bottom[bottomIndex];
  if (!topCue || !bottomCue) return null;
  return bottomCue.start - topCue.start;
}
