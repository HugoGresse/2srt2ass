import { encodeOutput } from './encoding';

/** Derive `movie.ass` from `movie.en.srt` / `movie.srt`-style names. */
export function outputFilename(sourceName: string | null): string {
  if (!sourceName) return 'subtitles.ass';
  const base = sourceName.replace(/\.(srt|vtt|txt)$/i, '');
  return `${base || 'subtitles'}.ass`;
}

/** Trigger a client-side download of the generated ASS file. */
export function downloadAss(filename: string, content: string, withBom: boolean): void {
  const bytes = encodeOutput(content, withBom);
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([buffer], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
