import { describe, expect, it } from 'vitest';
import { describeMkvFailure, sniffMkvTracks } from './mkv';

/** Build one EBML element: raw id bytes + 1-byte size VINT + payload. */
function el(idBytes: number[], payload: number[]): number[] {
  if (payload.length > 126) throw new Error('test helper limited to small payloads');
  return [...idBytes, 0x80 | payload.length, ...payload];
}

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

function buildMkv(unknownSegmentSize = false): ArrayBuffer {
  const videoEntry = el([0xae], [...el([0x83], [1]), ...el([0x86], ascii('V_MPEGH/ISO/HEVC'))]);
  const audioEntry = el([0xae], [...el([0x83], [2]), ...el([0x86], ascii('A_EAC3'))]);
  const subEntry = el([0xae], [...el([0x83], [0x11]), ...el([0x86], ascii('S_TEXT/UTF8'))]);
  const tracks = el([0x16, 0x54, 0xae, 0x6b], [...videoEntry, ...audioEntry, ...subEntry]);
  const segment = unknownSegmentSize
    ? [0x18, 0x53, 0x80, 0x67, 0xff, ...tracks]
    : el([0x18, 0x53, 0x80, 0x67], tracks);
  const header = el([0x1a, 0x45, 0xdf, 0xa3], []);
  return new Uint8Array([...header, ...segment]).buffer;
}

describe('sniffMkvTracks', () => {
  it('lists video, audio and subtitle tracks with codec ids', () => {
    const tracks = sniffMkvTracks(buildMkv());
    expect(tracks).toEqual([
      { type: 'video', codecId: 'V_MPEGH/ISO/HEVC' },
      { type: 'audio', codecId: 'A_EAC3' },
      { type: 'subtitle', codecId: 'S_TEXT/UTF8' },
    ]);
  });

  it('handles unknown-size segment elements', () => {
    const tracks = sniffMkvTracks(buildMkv(true));
    expect(tracks?.map((t) => t.codecId)).toContain('V_MPEGH/ISO/HEVC');
  });

  it('returns null for non-EBML data', () => {
    expect(sniffMkvTracks(new TextEncoder().encode('not a video').buffer as ArrayBuffer)).toBeNull();
    expect(sniffMkvTracks(new ArrayBuffer(2))).toBeNull();
  });
});

describe('describeMkvFailure', () => {
  it('names the unsupported video codec with a Chrome hint for HEVC', () => {
    const msg = describeMkvFailure({
      videoCodec: 'HEVC (H.265)',
      videoSupported: false,
      audioCodec: 'AAC',
      audioSupported: true,
      embeddedSubtitleCount: 0,
    });
    expect(msg).toContain('no HEVC (H.265) video decoder');
    expect(msg).toContain('Chrome/Edge');
  });

  it('names unsupported audio, falls back when nothing is pinpointed', () => {
    expect(
      describeMkvFailure({
        videoCodec: 'H.264',
        videoSupported: true,
        audioCodec: 'DTS',
        audioSupported: false,
        embeddedSubtitleCount: 0,
      }),
    ).toContain('DTS audio track isn’t supported');
    expect(
      describeMkvFailure({
        videoCodec: null,
        videoSupported: null,
        audioCodec: null,
        audioSupported: null,
        embeddedSubtitleCount: 0,
      }),
    ).toContain('try an MP4/WebM');
  });
});
