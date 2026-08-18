import { describe, expect, it } from 'vitest';
import { decodeWith, detectAndDecode, encodeOutput } from './encoding';

function buf(...bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

describe('detectAndDecode', () => {
  it('detects UTF-8 BOM', () => {
    const { text, encoding, confident } = detectAndDecode(
      buf(0xef, 0xbb, 0xbf, 0x68, 0x69),
    );
    expect(text).toBe('hi');
    expect(encoding).toBe('utf-8');
    expect(confident).toBe(true);
  });

  it('detects UTF-16 LE BOM', () => {
    const { text, encoding } = detectAndDecode(buf(0xff, 0xfe, 0x68, 0x00, 0x69, 0x00));
    expect(text).toBe('hi');
    expect(encoding).toBe('utf-16le');
  });

  it('accepts valid UTF-8 without BOM', () => {
    const bytes = new TextEncoder().encode('héllo — ok');
    const { text, encoding, confident } = detectAndDecode(bytes.buffer as ArrayBuffer);
    expect(text).toBe('héllo — ok');
    expect(encoding).toBe('utf-8');
    expect(confident).toBe(true);
  });

  it('falls back to windows-1252 for legacy bytes', () => {
    // "café" in latin-1/cp1252: 0xE9 is é and invalid as UTF-8 here.
    const { text, encoding, confident } = detectAndDecode(buf(0x63, 0x61, 0x66, 0xe9));
    expect(text).toBe('café');
    expect(encoding).toBe('windows-1252');
    expect(confident).toBe(false);
  });
});

describe('decodeWith', () => {
  it('decodes with an explicit label', () => {
    // 0xE9 in windows-1251 is "й".
    const { text } = decodeWith(buf(0xe9), 'windows-1251');
    expect(text).toBe('й');
  });
});

describe('encodeOutput', () => {
  it('prepends a UTF-8 BOM when asked', () => {
    const withBom = encodeOutput('x', true);
    expect([...withBom.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(withBom[3]).toBe(0x78);
    const plain = encodeOutput('x', false);
    expect([...plain]).toEqual([0x78]);
  });
});
