/** A single subtitle cue, times in seconds. */
export interface Cue {
  /** 1-based index as found in the source file (0 if absent). */
  index: number;
  start: number;
  end: number;
  /** Raw text, lines joined with \n, source tags (<i>, <b>, …) preserved. */
  text: string;
}

export interface ParseResult {
  cues: Cue[];
  /** Human-readable notes about recovered/skipped malformed blocks. */
  warnings: string[];
  /** Detected source format. */
  format: 'srt' | 'vtt';
}

export type TrackPosition = 'bottom' | 'top';

export type BorderStyle = 'outline' | 'opaque';

/** Style options for one subtitle track, mirroring ASS V4+ style fields. */
export interface TrackStyle {
  fontName: string;
  fontSize: number;
  /** #rrggbb */
  primaryColor: string;
  /** #rrggbb */
  outlineColor: string;
  /** #rrggbb — box color when borderStyle is 'opaque'. */
  backColor: string;
  bold: boolean;
  italic: boolean;
  borderStyle: BorderStyle;
  outlineWidth: number;
  shadow: number;
  position: TrackPosition;
  marginV: number;
}

/** One loaded subtitle track plus its processing options. */
export interface Track {
  cues: Cue[];
  /** Time shift in seconds applied before merging. */
  shift: number;
  style: TrackStyle;
}

export interface ScriptOptions {
  title: string;
  playResX: number;
  playResY: number;
}

export const PLAY_RES_X = 384;
export const PLAY_RES_Y = 288;

export function defaultStyle(position: TrackPosition): TrackStyle {
  return {
    fontName: 'Arial',
    fontSize: 16,
    // Bottom matches the original tool (&H00F9FFF9); top gets a warm tint so
    // both languages are distinguishable at a glance.
    primaryColor: position === 'bottom' ? '#f9fff9' : '#fffff9',
    outlineColor: '#000000',
    backColor: '#000000',
    bold: true,
    italic: false,
    borderStyle: 'outline',
    outlineWidth: 3,
    shadow: 0,
    position,
    marginV: 10,
  };
}

export function defaultScriptOptions(title = '2srt2ass'): ScriptOptions {
  return { title, playResX: PLAY_RES_X, playResY: PLAY_RES_Y };
}
