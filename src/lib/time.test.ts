import { describe, expect, it } from 'vitest';
import { formatAssTime, formatClock, formatSrtTime, parseTimestamp } from './time';

describe('parseTimestamp', () => {
  it('parses standard SRT timestamps', () => {
    expect(parseTimestamp('00:00:20,000')).toBe(20);
    expect(parseTimestamp('01:02:03,456')).toBeCloseTo(3723.456);
  });

  it('accepts dot as millisecond separator (VTT)', () => {
    expect(parseTimestamp('00:01:02.500')).toBeCloseTo(62.5);
  });

  it('accepts missing hours (VTT short form)', () => {
    expect(parseTimestamp('01:02.500')).toBeCloseTo(62.5);
  });

  it('scales 1-2 fraction digits correctly', () => {
    expect(parseTimestamp('00:00:01,5')).toBeCloseTo(1.5);
    expect(parseTimestamp('00:00:01,50')).toBeCloseTo(1.5);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseTimestamp('  00:00:01,000 ')).toBe(1);
  });

  it('rejects garbage', () => {
    expect(parseTimestamp('not a time')).toBeNull();
    expect(parseTimestamp('')).toBeNull();
    expect(parseTimestamp('00:00:01,1234')).toBeNull();
  });
});

describe('formatAssTime', () => {
  it('formats with centisecond precision', () => {
    expect(formatAssTime(20)).toBe('0:00:20.00');
    expect(formatAssTime(3723.456)).toBe('1:02:03.46');
  });

  it('rounds up across unit boundaries', () => {
    expect(formatAssTime(1.999)).toBe('0:00:02.00');
    expect(formatAssTime(59.999)).toBe('0:01:00.00');
  });

  it('clamps negatives to zero', () => {
    expect(formatAssTime(-5)).toBe('0:00:00.00');
  });
});

describe('formatSrtTime', () => {
  it('round-trips with parseTimestamp', () => {
    expect(formatSrtTime(3723.456)).toBe('01:02:03,456');
    expect(parseTimestamp(formatSrtTime(62.5))).toBeCloseTo(62.5);
  });
});

describe('formatClock', () => {
  it('shows minutes for short times, hours when needed', () => {
    expect(formatClock(62)).toBe('1:02');
    expect(formatClock(3723)).toBe('1:02:03');
  });
});
