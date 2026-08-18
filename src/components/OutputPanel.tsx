import { useState } from 'preact/hooks';
import { downloadAss } from '../lib/download';

interface OutputPanelProps {
  assText: string;
  filename: string;
  onFilenameChange: (name: string) => void;
}

/** Download / copy / inspect the generated ASS file. */
export function OutputPanel({ assText, filename, onFilenameChange }: OutputPanelProps) {
  const [withBom, setWithBom] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(assText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const sizeKb = (assText.length / 1024).toFixed(1);

  return (
    <section class="output-panel" aria-label="Download">
      <div class="output-row">
        <label class="field output-filename">
          <span>File name</span>
          <input
            type="text"
            value={filename}
            onInput={(e) => onFilenameChange((e.target as HTMLInputElement).value)}
            spellcheck={false}
          />
        </label>
        <label class="output-bom" title="Most players expect a UTF-8 byte-order mark">
          <input
            type="checkbox"
            checked={withBom}
            onChange={(e) => setWithBom((e.target as HTMLInputElement).checked)}
          />
          <span>UTF-8 BOM</span>
        </label>
      </div>

      <div class="output-actions">
        <button
          type="button"
          class="btn btn-primary"
          onClick={() => downloadAss(filename || 'subtitles.ass', assText, withBom)}
        >
          ⬇ Download .ass <span class="output-size">({sizeKb} kB)</span>
        </button>
        <button type="button" class="btn btn-ghost" onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy to clipboard'}
        </button>
        <button type="button" class="btn btn-ghost" onClick={() => setShowRaw((s) => !s)}>
          {showRaw ? 'Hide file content' : 'View file content'}
        </button>
      </div>

      {showRaw && (
        <pre class="output-raw" tabindex={0}>
          {assText}
        </pre>
      )}
    </section>
  );
}
