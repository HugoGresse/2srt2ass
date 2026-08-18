/**
 * Minimal Matroska/WebM track sniffer.
 *
 * Reads just enough EBML from the start of a file to list track codec IDs,
 * so decode failures can name the actual culprit ("HEVC not supported here")
 * instead of a generic error. No dependencies, no full demux.
 */

export interface MkvTrack {
  type: 'video' | 'audio' | 'subtitle' | 'other';
  codecId: string;
}

const ID_SEGMENT = 0x18538067;
const ID_TRACKS = 0x1654ae6b;
const ID_TRACK_ENTRY = 0xae;
const ID_TRACK_TYPE = 0x83;
const ID_CODEC_ID = 0x86;

/** Parse track list from the head of an MKV/WebM file. Null if not EBML. */
export function sniffMkvTracks(buffer: ArrayBuffer): MkvTrack[] | null {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 8) return null;
  // EBML magic 0x1A45DFA3
  if (bytes[0] !== 0x1a || bytes[1] !== 0x45 || bytes[2] !== 0xdf || bytes[3] !== 0xa3) {
    return null;
  }

  const tracks: MkvTrack[] = [];
  walk(bytes, 0, bytes.length, (id, start, end) => {
    if (id === ID_SEGMENT || id === ID_TRACKS) {
      walkInto(bytes, start, end);
      return;
    }
    if (id === ID_TRACK_ENTRY) {
      const track = parseTrackEntry(bytes, start, end);
      if (track) tracks.push(track);
    }
  });

  return tracks;

  // Nested helper so the visitor can recurse with shared state.
  function walkInto(
    data: Uint8Array,
    start: number,
    end: number,
  ): void {
    walk(data, start, end, (id, s, e) => {
      if (id === ID_SEGMENT || id === ID_TRACKS) {
        walkInto(data, s, e);
      } else if (id === ID_TRACK_ENTRY) {
        const track = parseTrackEntry(data, s, e);
        if (track) tracks.push(track);
      }
    });
  }
}

function parseTrackEntry(bytes: Uint8Array, start: number, end: number): MkvTrack | null {
  let type: MkvTrack['type'] = 'other';
  let codecId = '';
  walk(bytes, start, end, (id, s, e) => {
    if (id === ID_TRACK_TYPE && e > s) {
      const t = bytes[s]!;
      type = t === 1 ? 'video' : t === 2 ? 'audio' : t === 0x11 ? 'subtitle' : 'other';
    } else if (id === ID_CODEC_ID) {
      codecId = asciiSlice(bytes, s, e);
    }
  });
  return codecId ? { type, codecId } : null;
}

/** Iterate sibling EBML elements in [from, to); stops on malformed data. */
function walk(
  bytes: Uint8Array,
  from: number,
  to: number,
  visit: (id: number, payloadStart: number, payloadEnd: number) => void,
): void {
  let pos = from;
  while (pos < to) {
    const id = readElementId(bytes, pos);
    if (!id) return;
    const size = readVint(bytes, pos + id.length);
    if (!size) return;
    const payloadStart = pos + id.length + size.length;
    // Unknown-size elements (all VINT data bits set) extend to parent end.
    const payloadEnd = size.unknown
      ? to
      : Math.min(to, payloadStart + size.value);
    if (payloadStart > to) return;
    visit(id.value, payloadStart, payloadEnd);
    if (payloadEnd <= pos) return; // no forward progress — corrupt data
    pos = payloadEnd;
  }
}

/** EBML element IDs keep their marker bits (read raw, not VINT-decoded). */
function readElementId(bytes: Uint8Array, pos: number): { value: number; length: number } | null {
  const first = bytes[pos];
  if (first === undefined || first === 0) return null;
  const length = Math.clz32(first) - 23; // leading zeros in the first byte + 1
  if (length < 1 || length > 4 || pos + length > bytes.length) return null;
  let value = 0;
  for (let i = 0; i < length; i += 1) value = value * 256 + bytes[pos + i]!;
  return { value, length };
}

function readVint(
  bytes: Uint8Array,
  pos: number,
): { value: number; length: number; unknown: boolean } | null {
  const first = bytes[pos];
  if (first === undefined || first === 0) return null;
  const length = Math.clz32(first) - 23;
  if (length < 1 || length > 8 || pos + length > bytes.length) return null;
  let value = first & (0xff >> length);
  let allOnes = value === 0xff >> length;
  for (let i = 1; i < length; i += 1) {
    const b = bytes[pos + i]!;
    if (b !== 0xff) allOnes = false;
    value = value * 256 + b;
  }
  return { value, length, unknown: allOnes };
}

function asciiSlice(bytes: Uint8Array, start: number, end: number): string {
  let out = '';
  for (let i = start; i < end && i < start + 64; i += 1) {
    const c = bytes[i]!;
    if (c === 0) break;
    out += String.fromCharCode(c);
  }
  return out;
}

/** Human name + representative MIME string for support probing. */
const CODEC_INFO: Record<string, { name: string; probe?: string }> = {
  'V_MPEGH/ISO/HEVC': { name: 'HEVC (H.265)', probe: 'video/mp4; codecs="hvc1.1.6.L120.B0"' },
  'V_MPEG4/ISO/AVC': { name: 'H.264', probe: 'video/mp4; codecs="avc1.640028"' },
  V_AV1: { name: 'AV1', probe: 'video/mp4; codecs="av01.0.08M.08"' },
  V_VP9: { name: 'VP9', probe: 'video/webm; codecs="vp9"' },
  V_VP8: { name: 'VP8', probe: 'video/webm; codecs="vp8"' },
  A_AAC: { name: 'AAC', probe: 'audio/mp4; codecs="mp4a.40.2"' },
  A_OPUS: { name: 'Opus', probe: 'audio/webm; codecs="opus"' },
  A_VORBIS: { name: 'Vorbis', probe: 'audio/webm; codecs="vorbis"' },
  A_FLAC: { name: 'FLAC', probe: 'audio/mp4; codecs="flac"' },
  A_EAC3: { name: 'Dolby Digital Plus (E-AC-3)', probe: 'audio/mp4; codecs="ec-3"' },
  A_AC3: { name: 'Dolby Digital (AC-3)', probe: 'audio/mp4; codecs="ac-3"' },
  'A_DTS': { name: 'DTS' },
  A_TRUEHD: { name: 'Dolby TrueHD' },
  'S_TEXT/UTF8': { name: 'SRT subtitles' },
  'S_TEXT/ASS': { name: 'ASS subtitles' },
  S_HDMV_PGS: { name: 'PGS subtitles' },
};

export interface MkvDiagnosis {
  /** e.g. "HEVC (H.265)" */
  videoCodec: string | null;
  videoSupported: boolean | null;
  audioCodec: string | null;
  audioSupported: boolean | null;
  embeddedSubtitleCount: number;
}

/** Combine sniffed tracks with this browser's decode capabilities. */
export function diagnoseMkv(tracks: MkvTrack[]): MkvDiagnosis {
  const video = tracks.find((t) => t.type === 'video');
  const audio = tracks.find((t) => t.type === 'audio');
  const subs = tracks.filter((t) => t.type === 'subtitle').length;

  const probe = (codecId: string | undefined): [string | null, boolean | null] => {
    if (!codecId) return [null, null];
    const info = CODEC_INFO[codecId];
    const name = info?.name ?? codecId;
    if (!info?.probe || typeof document === 'undefined') return [name, info?.probe ? null : false];
    const support = document.createElement('video').canPlayType(info.probe);
    return [name, support !== ''];
  };

  const [videoCodec, videoSupported] = probe(video?.codecId);
  const [audioCodec, audioSupported] = probe(audio?.codecId);
  return { videoCodec, videoSupported, audioCodec, audioSupported, embeddedSubtitleCount: subs };
}

/** Build the user-facing explanation for a failed MKV. */
export function describeMkvFailure(d: MkvDiagnosis): string {
  const parts: string[] = [];
  if (d.videoCodec && d.videoSupported === false) {
    parts.push(`this browser has no ${d.videoCodec} video decoder`);
  }
  if (d.audioCodec && d.audioSupported === false) {
    parts.push(`the ${d.audioCodec} audio track isn’t supported`);
  }
  if (parts.length === 0) {
    return 'This browser can’t decode that file — try an MP4/WebM, or Chrome for MKV.';
  }
  const detail = parts.join(' and ');
  const hint =
    d.videoCodec?.includes('HEVC') === true
      ? ' Chrome/Edge with hardware HEVC support can play it.'
      : '';
  return `Can’t play this file: ${detail}.${hint}`;
}
