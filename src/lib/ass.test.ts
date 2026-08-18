import { describe, expect, it } from 'vitest';
import { assColorToHex, buildAss, hexToAssColor, srtTextToAss, styleLine } from './ass';
import { defaultScriptOptions, defaultStyle, type Track } from './types';

describe('hexToAssColor', () => {
  it('converts #rrggbb to &HAABBGGRR', () => {
    expect(hexToAssColor('#f9fff9')).toBe('&H00F9FFF9');
    expect(hexToAssColor('#ff0000')).toBe('&H000000FF');
    expect(hexToAssColor('0000ff')).toBe('&H00FF0000');
  });

  it('supports alpha and falls back to white on garbage', () => {
    expect(hexToAssColor('#000000', 128)).toBe('&H80000000');
    expect(hexToAssColor('nonsense')).toBe('&H00FFFFFF');
  });

  it('round-trips with assColorToHex', () => {
    expect(assColorToHex(hexToAssColor('#12ab34'))).toBe('#12ab34');
    expect(assColorToHex('&H00F9FFF9')).toBe('#f9fff9');
  });
});

describe('srtTextToAss', () => {
  it('converts newlines to \\N', () => {
    expect(srtTextToAss('one\ntwo')).toBe('one\\Ntwo');
    expect(srtTextToAss('one\r\ntwo')).toBe('one\\Ntwo');
  });

  it('converts italic, bold and underline tags', () => {
    expect(srtTextToAss('<i>it</i>')).toBe('{\\i1}it{\\i0}');
    // The original C++ tool emitted {\b0} for <b> — regression guard for the fix.
    expect(srtTextToAss('<b>bold</b>')).toBe('{\\b1}bold{\\b0}');
    expect(srtTextToAss('<u>under</u>')).toBe('{\\u1}under{\\u0}');
  });

  it('converts font color tags (hex and named)', () => {
    expect(srtTextToAss('<font color="#ff0000">red</font>')).toBe(
      '{\\c&H0000FF&}red{\\c}',
    );
    expect(srtTextToAss('<font color=yellow>y</font>')).toBe('{\\c&H00FFFF&}y{\\c}');
  });

  it('strips unknown tags but keeps their content', () => {
    expect(srtTextToAss('<span foo>x</span>')).toBe('x');
  });

  it('neutralizes literal braces without touching generated overrides', () => {
    expect(srtTextToAss('a {weird} <i>note</i>')).toBe('a (weird) {\\i1}note{\\i0}');
  });
});

describe('styleLine', () => {
  it('serializes the default bottom style like the original tool', () => {
    const line = styleLine('Bot', defaultStyle('bottom'));
    expect(line).toBe(
      'Style: Bot,Arial,16,&H00F9FFF9,&H00FFFFFF,&H00000000,&H00000000,' +
        '-1,0,0,0,100,100,0,0,1,3,0,2,10,10,10,1',
    );
  });

  it('uses alignment 8 and border style 3 for opaque top tracks', () => {
    const style = { ...defaultStyle('top'), borderStyle: 'opaque' as const };
    const line = styleLine('Top', style);
    expect(line).toContain(',3,3,0,8,');
  });
});

describe('buildAss', () => {
  const cue = (start: number, end: number, text: string, index = 1) => ({
    index,
    start,
    end,
    text,
  });

  const track = (cues: ReturnType<typeof cue>[], shift = 0, position: 'top' | 'bottom' = 'bottom'): Track => ({
    cues,
    shift,
    style: defaultStyle(position),
  });

  it('produces a complete script with events sorted by start', () => {
    const bottom = track([cue(4, 6, 'later'), cue(1, 2, 'early')]);
    const top = track([cue(2, 3, 'boven')], 0, 'top');
    const out = buildAss(bottom, top, defaultScriptOptions());

    expect(out).toContain('[Script Info]');
    expect(out).toContain('ScriptType: v4.00+');
    expect(out).toContain('PlayResX: 384');
    expect(out.split('\r\n').length).toBeGreaterThan(10);

    const dialogues = out
      .split('\r\n')
      .filter((l) => l.startsWith('Dialogue:'));
    expect(dialogues).toHaveLength(3);
    expect(dialogues[0]).toContain('early');
    expect(dialogues[1]).toContain('boven');
    expect(dialogues[1]).toContain(',Top,');
    expect(dialogues[2]).toContain('later');
  });

  it('applies per-track shift to event times', () => {
    const bottom = track([cue(1, 2, 'x')], 2.5);
    const out = buildAss(bottom, null, defaultScriptOptions());
    expect(out).toContain('Dialogue: 0,0:00:03.50,0:00:04.50,Bot');
  });

  it('omits the Top style when only one track is present', () => {
    const out = buildAss(track([cue(1, 2, 'solo')]), null, defaultScriptOptions());
    expect(out).toContain('Style: Bot,');
    expect(out).not.toContain('Style: Top,');
  });
});
