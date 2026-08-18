import { describe, expect, it } from 'vitest';
import { alignmentDistance, autoSync, shiftFromPair } from './sync';
import type { Cue } from './types';

/** Build a plausible subtitle track: cues every ~3-5 s with 2-3 s duration. */
function makeTrack(count: number, offset = 0): Cue[] {
  const cues: Cue[] = [];
  let t = 1 + offset;
  for (let i = 0; i < count; i += 1) {
    const duration = 2 + ((i * 7) % 3) * 0.5;
    cues.push({ index: i + 1, start: t, end: t + duration, text: `line ${i}` });
    t += duration + 1 + ((i * 13) % 4) * 0.7;
  }
  return cues;
}

function shifted(cues: Cue[], by: number): Cue[] {
  return cues.map((c) => ({ ...c, start: c.start + by, end: c.end + by }));
}

describe('alignmentDistance', () => {
  it('is zero for identical tracks at zero offset', () => {
    const track = makeTrack(50);
    expect(alignmentDistance(track, track, 0)).toBe(0);
  });

  it('grows with misalignment', () => {
    const track = makeTrack(50);
    const near = alignmentDistance(track, shifted(track, 0.2), 0.2);
    const far = alignmentDistance(track, shifted(track, 0.2), 2);
    expect(near).toBeLessThan(far);
  });

  it('returns 0 for empty inputs', () => {
    expect(alignmentDistance([], makeTrack(3), 0)).toBe(0);
  });
});

describe('autoSync', () => {
  it('recovers a known shift', () => {
    const bottom = makeTrack(120);
    const top = shifted(bottom, 3.21);
    const result = autoSync(top, bottom);
    expect(result.shift).toBeCloseTo(-3.21, 2);
    expect(result.distance).toBeLessThan(result.baseline);
  });

  it('recovers large shifts beyond the original ±10 s range', () => {
    const bottom = makeTrack(120);
    const top = shifted(bottom, -17.4);
    const result = autoSync(top, bottom);
    expect(result.shift).toBeCloseTo(17.4, 2);
  });

  it('finds ~zero shift for already-aligned tracks with different cue sets', () => {
    const bottom = makeTrack(100);
    // Same timeline, every other cue missing — like a translation with fewer lines.
    const top = bottom.filter((_, i) => i % 2 === 0);
    const result = autoSync(top, bottom);
    expect(Math.abs(result.shift)).toBeLessThanOrEqual(0.05);
  });
});

describe('shiftFromPair', () => {
  it('computes bottom.start - top.start', () => {
    const bottom = makeTrack(10);
    const top = shifted(bottom, 2);
    expect(shiftFromPair(top, bottom, 3, 3)).toBeCloseTo(-2);
  });

  it('returns null for out-of-range indices', () => {
    expect(shiftFromPair(makeTrack(2), makeTrack(2), 5, 0)).toBeNull();
  });
});
