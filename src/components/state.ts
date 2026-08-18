import { decodeWith, detectAndDecode } from '../lib/encoding';
import { parseSubtitles } from '../lib/srt';
import type { ParseResult, Track, TrackPosition, TrackStyle } from '../lib/types';
import { defaultStyle } from '../lib/types';

/** One loaded subtitle file plus everything derived from it. */
export interface LoadedTrack {
  fileName: string;
  /** Raw bytes kept around so the user can re-decode with another encoding. */
  buffer: ArrayBuffer;
  encoding: string;
  /** Encoding the automatic detection picked (shown as a hint). */
  detectedEncoding: string;
  encodingConfident: boolean;
  parse: ParseResult;
  shift: number;
  style: TrackStyle;
}

export interface AppState {
  bottom: LoadedTrack | null;
  top: LoadedTrack | null;
}

/** Read a File and build a LoadedTrack with auto-detected encoding. */
export async function loadTrackFromFile(
  file: File,
  position: TrackPosition,
): Promise<LoadedTrack> {
  const buffer = await file.arrayBuffer();
  const decoded = detectAndDecode(buffer);
  return {
    fileName: file.name,
    buffer,
    encoding: decoded.encoding,
    detectedEncoding: decoded.encoding,
    encodingConfident: decoded.confident,
    parse: parseSubtitles(decoded.text),
    shift: 0,
    style: defaultStyle(position),
  };
}

/** Re-decode an existing track with a user-chosen encoding. */
export function reencodeTrack(track: LoadedTrack, encoding: string): LoadedTrack {
  const decoded = decodeWith(track.buffer, encoding);
  return {
    ...track,
    encoding,
    encodingConfident: true,
    parse: parseSubtitles(decoded.text),
  };
}

/** Swap the two tracks, keeping position-bound style fields in place. */
export function swapTracks(state: AppState): AppState {
  const repos = (t: LoadedTrack | null, position: TrackPosition): LoadedTrack | null =>
    t ? { ...t, style: { ...t.style, position } } : null;
  return { bottom: repos(state.top, 'bottom'), top: repos(state.bottom, 'top') };
}

/** Convert a LoadedTrack to the pure Track consumed by buildAss. */
export function toAssTrack(track: LoadedTrack | null): Track | null {
  if (!track) return null;
  return { cues: track.parse.cues, shift: track.shift, style: track.style };
}

/**
 * Decide where dropped files land: fill empty slots first (bottom before
 * top), then start replacing from the bottom slot.
 */
export function planFileAssignment(
  state: AppState,
  fileCount: number,
): TrackPosition[] {
  const plan: TrackPosition[] = [];
  let { bottom, top } = { bottom: state.bottom !== null, top: state.top !== null };
  for (let i = 0; i < fileCount && plan.length < 2; i += 1) {
    if (!bottom) {
      plan.push('bottom');
      bottom = true;
    } else if (!top) {
      plan.push('top');
      top = true;
    } else {
      // Both slots taken: a single extra file replaces the bottom track.
      plan.push('bottom');
    }
  }
  return plan;
}

const SUBTITLE_EXTENSIONS = /\.(srt|vtt|txt)$/i;

export function isSubtitleFile(file: File): boolean {
  return SUBTITLE_EXTENSIONS.test(file.name);
}
