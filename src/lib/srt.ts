import type { Cue, ParseResult } from './types';
import { parseTimestamp } from './time';

/**
 * Lenient SRT/WebVTT parser.
 *
 * Tolerates: BOM, CRLF/CR/LF, missing or non-numeric index lines, `.` as the
 * millisecond separator, VTT headers and cue settings, and blank-line noise.
 * Malformed blocks are skipped and reported as warnings instead of failing
 * the whole file.
 */
export function parseSubtitles(input: string): ParseResult {
  const text = input.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const isVtt = /^WEBVTT/.test(text.trimStart());

  const warnings: string[] = [];
  const cues: Cue[] = [];

  const blocks = text.split(/\n{2,}/);
  let autoIndex = 0;

  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '' || false);
    if (lines.length === 0) continue;

    const timingLineIdx = lines.findIndex((l) => l.includes('-->'));
    if (timingLineIdx === -1) {
      if (isVtt && isVttMetaBlock(lines[0]!)) continue;
      if (isNoiseBlock(lines)) continue;
      warnings.push(`Skipped block without a timing line: “${preview(lines)}”`);
      continue;
    }

    const timing = parseTimingLine(lines[timingLineIdx]!);
    if (!timing) {
      warnings.push(`Skipped block with unparseable timing: “${preview(lines)}”`);
      continue;
    }

    let index = 0;
    if (timingLineIdx > 0) {
      const parsed = Number.parseInt(lines[timingLineIdx - 1]!.trim(), 10);
      if (Number.isFinite(parsed)) index = parsed;
    }
    autoIndex += 1;
    if (index === 0) index = autoIndex;

    const textLines = lines.slice(timingLineIdx + 1);
    const cueText = cleanCueText(textLines.join('\n'), isVtt);
    if (cueText === '') continue;

    if (timing.end < timing.start) {
      warnings.push(`Cue ${index} ends before it starts; times swapped.`);
      [timing.start, timing.end] = [timing.end, timing.start];
    }

    cues.push({ index, start: timing.start, end: timing.end, text: cueText });
  }

  cues.sort((a, b) => a.start - b.start);

  if (cues.length === 0) {
    warnings.push('No subtitle cues found in this file.');
  }

  return { cues, warnings, format: isVtt ? 'vtt' : 'srt' };
}

function parseTimingLine(line: string): { start: number; end: number } | null {
  const [rawStart, rawRest] = line.split('-->');
  if (rawStart === undefined || rawRest === undefined) return null;
  // VTT allows cue settings after the end time ("00:01.000 line:0"); SRT files
  // occasionally carry legacy "X1:… X2:…" coordinates. Keep the first token.
  const rawEnd = rawRest.trim().split(/\s+/)[0] ?? '';
  const start = parseTimestamp(rawStart);
  const end = parseTimestamp(rawEnd);
  if (start === null || end === null) return null;
  return { start, end };
}

function cleanCueText(text: string, isVtt: boolean): string {
  let out = text;
  if (isVtt) {
    // Drop voice/class wrappers but keep their inner text.
    out = out.replace(/<\/?v(?:\s[^>]*)?>/gi, '').replace(/<\/?c(?:\.[^>]*)?>/gi, '');
    // Timestamps tags used for karaoke-style painting.
    out = out.replace(/<\d{1,3}:\d{2}(?::\d{2})?[.,]\d{1,3}>/g, '');
  }
  return out.trim();
}

function isVttMetaBlock(firstLine: string): boolean {
  return /^(WEBVTT|NOTE|STYLE|REGION)\b/.test(firstLine.trim());
}

/** Bare numbers (orphan index lines) or byte junk are silently ignored. */
function isNoiseBlock(lines: string[]): boolean {
  return lines.every((l) => /^\d+$/.test(l.trim()) || l.trim() === '');
}

function preview(lines: string[]): string {
  const joined = lines.join(' ').slice(0, 40);
  return joined.length < lines.join(' ').length ? `${joined}…` : joined;
}

/** Total span of a cue list in seconds (0 for empty lists). */
export function cuesDuration(cues: Cue[]): number {
  if (cues.length === 0) return 0;
  return Math.max(...cues.map((c) => c.end));
}
