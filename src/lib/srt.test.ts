import { describe, expect, it } from 'vitest';
import { cuesDuration, parseSubtitles } from './srt';

const BASIC = `1
00:00:01,000 --> 00:00:03,000
Hello world

2
00:00:04,000 --> 00:00:06,500
Second line
over two rows
`;

describe('parseSubtitles (SRT)', () => {
  it('parses a well-formed file', () => {
    const { cues, warnings, format } = parseSubtitles(BASIC);
    expect(format).toBe('srt');
    expect(warnings).toEqual([]);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ index: 1, start: 1, end: 3, text: 'Hello world' });
    expect(cues[1]!.text).toBe('Second line\nover two rows');
  });

  it('handles CRLF line endings and BOM', () => {
    const crlf = '﻿' + BASIC.replace(/\n/g, '\r\n');
    const { cues } = parseSubtitles(crlf);
    expect(cues).toHaveLength(2);
    expect(cues[0]!.text).toBe('Hello world');
  });

  it('tolerates a missing index line', () => {
    const noIndex = `00:00:01,000 --> 00:00:02,000\nNo index here\n`;
    const { cues } = parseSubtitles(noIndex);
    expect(cues).toHaveLength(1);
    expect(cues[0]!.index).toBe(1);
  });

  it('tolerates dot millisecond separators', () => {
    const dotted = `1\n00:00:01.000 --> 00:00:02.000\nDots\n`;
    const { cues } = parseSubtitles(dotted);
    expect(cues).toHaveLength(1);
    expect(cues[0]!.start).toBe(1);
  });

  it('skips malformed blocks with a warning but keeps good ones', () => {
    const mixed = `garbage without timing\n\n1\n00:00:01,000 --> 00:00:02,000\nGood\n`;
    const { cues, warnings } = parseSubtitles(mixed);
    expect(cues).toHaveLength(1);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('swaps start/end when reversed', () => {
    const reversed = `1\n00:00:05,000 --> 00:00:02,000\nBackwards\n`;
    const { cues, warnings } = parseSubtitles(reversed);
    expect(cues[0]).toMatchObject({ start: 2, end: 5 });
    expect(warnings.some((w) => w.includes('swapped'))).toBe(true);
  });

  it('sorts cues by start time', () => {
    const outOfOrder = `2\n00:00:10,000 --> 00:00:11,000\nLater\n\n1\n00:00:01,000 --> 00:00:02,000\nEarlier\n`;
    const { cues } = parseSubtitles(outOfOrder);
    expect(cues.map((c) => c.text)).toEqual(['Earlier', 'Later']);
  });

  it('ignores legacy coordinate suffixes on the timing line', () => {
    const coords = `1\n00:00:01,000 --> 00:00:02,000 X1:100 X2:200 Y1:400 Y2:430\nPositioned\n`;
    const { cues } = parseSubtitles(coords);
    expect(cues[0]!.end).toBe(2);
  });

  it('reports empty files', () => {
    const { cues, warnings } = parseSubtitles('');
    expect(cues).toHaveLength(0);
    expect(warnings.some((w) => w.includes('No subtitle cues'))).toBe(true);
  });
});

describe('parseSubtitles (WebVTT)', () => {
  it('parses VTT with header, settings and voice tags', () => {
    const vtt = `WEBVTT

NOTE a comment

00:01.000 --> 00:03.000 line:0 align:start
<v Fred>Hi there!</v>

00:04.000 --> 00:05.000
Plain <c.highlight>styled</c> text
`;
    const { cues, format } = parseSubtitles(vtt);
    expect(format).toBe('vtt');
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ start: 1, end: 3, text: 'Hi there!' });
    expect(cues[1]!.text).toBe('Plain styled text');
  });
});

describe('cuesDuration', () => {
  it('returns the max end time', () => {
    const { cues } = parseSubtitles(BASIC);
    expect(cuesDuration(cues)).toBe(6.5);
    expect(cuesDuration([])).toBe(0);
  });
});
