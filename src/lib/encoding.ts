/**
 * Character-encoding detection and decoding on top of the browser's
 * TextDecoder — replaces the original tool's iconv dependency.
 */

export interface DecodedFile {
  text: string;
  /** TextDecoder label actually used. */
  encoding: string;
  /** False when we fell back heuristically and the user may want to override. */
  confident: boolean;
}

/** Encodings offered in the manual-override dropdown, grouped for the UI. */
export const ENCODING_GROUPS: ReadonlyArray<{
  label: string;
  encodings: ReadonlyArray<{ value: string; label: string }>;
}> = [
  {
    label: 'Unicode',
    encodings: [
      { value: 'utf-8', label: 'UTF-8' },
      { value: 'utf-16le', label: 'UTF-16 LE' },
      { value: 'utf-16be', label: 'UTF-16 BE' },
    ],
  },
  {
    label: 'Western / Central European',
    encodings: [
      { value: 'windows-1252', label: 'Windows-1252 (Western)' },
      { value: 'iso-8859-15', label: 'ISO-8859-15 (Western, €)' },
      { value: 'windows-1250', label: 'Windows-1250 (Central European)' },
      { value: 'iso-8859-2', label: 'ISO-8859-2 (Central European)' },
    ],
  },
  {
    label: 'Cyrillic / Greek / Turkish',
    encodings: [
      { value: 'windows-1251', label: 'Windows-1251 (Cyrillic)' },
      { value: 'koi8-r', label: 'KOI8-R (Russian)' },
      { value: 'windows-1253', label: 'Windows-1253 (Greek)' },
      { value: 'windows-1254', label: 'Windows-1254 (Turkish)' },
    ],
  },
  {
    label: 'Middle Eastern',
    encodings: [
      { value: 'windows-1255', label: 'Windows-1255 (Hebrew)' },
      { value: 'windows-1256', label: 'Windows-1256 (Arabic)' },
    ],
  },
  {
    label: 'Asian',
    encodings: [
      { value: 'shift_jis', label: 'Shift_JIS (Japanese)' },
      { value: 'euc-jp', label: 'EUC-JP (Japanese)' },
      { value: 'euc-kr', label: 'EUC-KR (Korean)' },
      { value: 'gbk', label: 'GBK (Simplified Chinese)' },
      { value: 'big5', label: 'Big5 (Traditional Chinese)' },
    ],
  },
  {
    label: 'Other',
    encodings: [
      { value: 'windows-1257', label: 'Windows-1257 (Baltic)' },
      { value: 'windows-874', label: 'Windows-874 (Thai)' },
      { value: 'macintosh', label: 'Mac Roman' },
    ],
  },
];

/**
 * Decode a subtitle file, guessing the encoding.
 * Strategy: BOM sniffing → strict UTF-8 attempt → Windows-1252 fallback
 * (the most common legacy encoding for subtitle files in the wild).
 */
export function detectAndDecode(buffer: ArrayBuffer): DecodedFile {
  const bytes = new Uint8Array(buffer);

  const bom = sniffBom(bytes);
  if (bom) {
    return { text: decode(buffer, bom), encoding: bom, confident: true };
  }

  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return { text, encoding: 'utf-8', confident: true };
  } catch {
    // Not valid UTF-8 — legacy 8-bit encoding. Windows-1252 decodes any byte
    // sequence, so this never throws; user can override from the UI.
    return { text: decode(buffer, 'windows-1252'), encoding: 'windows-1252', confident: false };
  }
}

/** Decode with an explicit user-chosen encoding label. */
export function decodeWith(buffer: ArrayBuffer, encoding: string): DecodedFile {
  return { text: decode(buffer, encoding), encoding, confident: true };
}

function decode(buffer: ArrayBuffer, label: string): string {
  // Non-fatal mode replaces bad sequences with U+FFFD instead of throwing.
  return new TextDecoder(label).decode(buffer).replace(/^﻿/, '');
}

function sniffBom(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return 'utf-8';
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';
  return null;
}

/** Encode text for download. ASS players are happiest with a UTF-8 BOM. */
export function encodeOutput(text: string, withBom: boolean): Uint8Array {
  const body = new TextEncoder().encode(text);
  if (!withBom) return body;
  const out = new Uint8Array(body.length + 3);
  out.set([0xef, 0xbb, 0xbf], 0);
  out.set(body, 3);
  return out;
}
