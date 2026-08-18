import type { Cue, ScriptOptions, Track, TrackStyle } from './types';
import { formatAssTime } from './time';

/**
 * Convert a #rrggbb hex color to ASS `&HAABBGGRR` (alpha 00 = opaque).
 * Invalid input falls back to opaque white.
 */
export function hexToAssColor(hex: string, alpha = 0): string {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  const rgb = m ? m[1]! : 'ffffff';
  const r = rgb.slice(0, 2);
  const g = rgb.slice(2, 4);
  const b = rgb.slice(4, 6);
  return `&H${byteHex(alpha)}${b}${g}${r}`.toUpperCase();
}

/** Convert ASS `&HAABBGGRR` (or `&HBBGGRR`) back to #rrggbb. */
export function assColorToHex(assColor: string): string {
  const m = assColor.trim().match(/^&H([0-9A-F]{2})?([0-9A-F]{6})&?$/i);
  if (!m) return '#ffffff';
  const bgr = m[2]!;
  return `#${bgr.slice(4, 6)}${bgr.slice(2, 4)}${bgr.slice(0, 2)}`.toLowerCase();
}

function byteHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

/**
 * Convert SRT markup to ASS override tags.
 * Handles <i>/<b>/<u>, <font color>, strips anything else HTML-ish.
 * (The original C++ tool mapped <b> to {\b0} — a bug, fixed here.)
 */
export function srtTextToAss(text: string): string {
  return (
    text
      .replace(/\r\n?/g, '\n')
      // Literal braces first, so they can't be parsed as override blocks and
      // can't collide with the tags we insert below.
      .replace(/[{}]/g, (ch) => (ch === '{' ? '(' : ')'))
      .replace(/<i\s*>/gi, '{\\i1}')
      .replace(/<\/i\s*>/gi, '{\\i0}')
      .replace(/<b\s*>/gi, '{\\b1}')
      .replace(/<\/b\s*>/gi, '{\\b0}')
      .replace(/<u\s*>/gi, '{\\u1}')
      .replace(/<\/u\s*>/gi, '{\\u0}')
      .replace(/<font\b[^>]*color\s*=\s*["']?(#?[0-9a-z]+)["']?[^>]*>/gi, (_all, color: string) =>
        fontColorToOverride(color),
      )
      .replace(/<\/font\s*>/gi, '{\\c}')
      // Any other tag (e.g. <span>, stray timestamps) is dropped.
      .replace(/<[^>\n]*>/g, '')
      .replace(/\n/g, '\\N')
  );
}

const NAMED_COLORS: Record<string, string> = {
  white: 'ffffff', black: '000000', red: 'ff0000', green: '008000',
  blue: '0000ff', yellow: 'ffff00', cyan: '00ffff', magenta: 'ff00ff',
  orange: 'ffa500', gray: '808080', grey: '808080', lime: '00ff00',
};

function fontColorToOverride(raw: string): string {
  const named = NAMED_COLORS[raw.toLowerCase()];
  const hexMatch = raw.match(/^#?([0-9a-f]{6})$/i);
  const rgb = named ?? (hexMatch ? hexMatch[1]! : null);
  if (!rgb) return '';
  const b = rgb.slice(4, 6);
  const g = rgb.slice(2, 4);
  const r = rgb.slice(0, 2);
  return `{\\c&H${(b + g + r).toUpperCase()}&}`;
}

const STYLE_FORMAT =
  'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, ' +
  'OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ' +
  'ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, ' +
  'Alignment, MarginL, MarginR, MarginV, Encoding';

const EVENT_FORMAT =
  'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text';

/** ASS numpad alignment: 2 = bottom-center, 8 = top-center. */
function alignment(style: TrackStyle): number {
  return style.position === 'top' ? 8 : 2;
}

export function styleLine(name: string, s: TrackStyle): string {
  const borderStyle = s.borderStyle === 'opaque' ? 3 : 1;
  const fields = [
    name,
    s.fontName,
    s.fontSize,
    hexToAssColor(s.primaryColor),
    hexToAssColor('#ffffff'),
    hexToAssColor(s.outlineColor),
    s.borderStyle === 'opaque' ? hexToAssColor(s.backColor, 128) : hexToAssColor(s.backColor),
    s.bold ? -1 : 0,
    s.italic ? -1 : 0,
    0, // Underline
    0, // StrikeOut
    100, // ScaleX
    100, // ScaleY
    0, // Spacing
    0, // Angle
    borderStyle,
    s.outlineWidth,
    s.shadow,
    alignment(s),
    10, // MarginL
    10, // MarginR
    s.marginV,
    1, // Encoding (1 = default charset)
  ];
  return `Style: ${fields.join(',')}`;
}

interface EventEntry {
  start: number;
  end: number;
  styleName: string;
  text: string;
}

/**
 * Build the complete ASS file for up to two tracks.
 * Named tracks: "Bot" renders below, "Top" above — same names as the
 * original tool so downstream scripts keep working.
 */
export function buildAss(
  bottom: Track | null,
  top: Track | null,
  script: ScriptOptions,
): string {
  const events: EventEntry[] = [];
  if (bottom) pushTrack(events, bottom, 'Bot');
  if (top) pushTrack(events, top, 'Top');
  events.sort((a, b) => a.start - b.start);

  const lines: string[] = [
    '[Script Info]',
    `Title: ${sanitizeInfo(script.title)}`,
    'ScriptType: v4.00+',
    'Collisions: Normal',
    'PlayDepth: 0',
    `PlayResX: ${script.playResX}`,
    `PlayResY: ${script.playResY}`,
    'Timer: 100.0000',
    'WrapStyle: 0',
    'ScaledBorderAndShadow: no',
    '',
    '[V4+ Styles]',
    STYLE_FORMAT,
  ];
  if (bottom) lines.push(styleLine('Bot', bottom.style));
  if (top) lines.push(styleLine('Top', top.style));
  lines.push('', '[Events]', EVENT_FORMAT);

  for (const ev of events) {
    lines.push(
      `Dialogue: 0,${formatAssTime(ev.start)},${formatAssTime(ev.end)},` +
        `${ev.styleName},,0000,0000,0000,,${ev.text}`,
    );
  }

  return lines.join('\r\n') + '\r\n';
}

function pushTrack(events: EventEntry[], track: Track, styleName: string): void {
  for (const cue of track.cues) {
    events.push({
      start: cue.start + track.shift,
      end: cue.end + track.shift,
      styleName,
      text: srtTextToAss(cue.text),
    });
  }
}

/** Newlines or exotic control chars inside header values would corrupt the file. */
function sanitizeInfo(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim() || '2srt2ass';
}

/** Shift every cue of a list by `shift` seconds (pure — returns new cues). */
export function shiftCues(cues: Cue[], shift: number): Cue[] {
  if (shift === 0) return cues;
  return cues.map((c) => ({ ...c, start: c.start + shift, end: c.end + shift }));
}
