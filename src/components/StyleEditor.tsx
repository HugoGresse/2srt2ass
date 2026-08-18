import type { TrackStyle } from '../lib/types';

interface StyleEditorProps {
  style: TrackStyle;
  onChange: (style: TrackStyle) => void;
}

const FONT_SUGGESTIONS = [
  'Arial',
  'Helvetica',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Roboto',
  'Open Sans',
  'Noto Sans',
];

/** Controls for one track's ASS style (font, colors, border). */
export function StyleEditor({ style, onChange }: StyleEditorProps) {
  const set = <K extends keyof TrackStyle>(key: K, value: TrackStyle[K]) =>
    onChange({ ...style, [key]: value });

  return (
    <div class="style-editor">
      <label class="field">
        <span>Font</span>
        <input
          type="text"
          list="font-suggestions"
          value={style.fontName}
          onInput={(e) => set('fontName', (e.target as HTMLInputElement).value || 'Arial')}
        />
        <datalist id="font-suggestions">
          {FONT_SUGGESTIONS.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
      </label>

      <label class="field field-narrow">
        <span>Size</span>
        <input
          type="number"
          min={6}
          max={72}
          value={style.fontSize}
          onInput={(e) => set('fontSize', clampInt(e, 6, 72, 16))}
        />
      </label>

      <label class="field field-color">
        <span>Text</span>
        <input
          type="color"
          value={style.primaryColor}
          onInput={(e) => set('primaryColor', (e.target as HTMLInputElement).value)}
        />
      </label>

      <label class="field field-color">
        <span>{style.borderStyle === 'opaque' ? 'Box' : 'Outline'}</span>
        {style.borderStyle === 'opaque' ? (
          <input
            type="color"
            value={style.backColor}
            onInput={(e) => set('backColor', (e.target as HTMLInputElement).value)}
          />
        ) : (
          <input
            type="color"
            value={style.outlineColor}
            onInput={(e) => set('outlineColor', (e.target as HTMLInputElement).value)}
          />
        )}
      </label>

      <label class="field field-narrow">
        <span>Border</span>
        <input
          type="number"
          min={0}
          max={10}
          value={style.outlineWidth}
          onInput={(e) => set('outlineWidth', clampInt(e, 0, 10, 3))}
        />
      </label>

      <div class="field field-toggles">
        <span>Style</span>
        <div class="toggle-row">
          <button
            type="button"
            class={`chip ${style.bold ? 'chip-on' : ''}`}
            onClick={() => set('bold', !style.bold)}
            title="Bold"
          >
            B
          </button>
          <button
            type="button"
            class={`chip chip-italic ${style.italic ? 'chip-on' : ''}`}
            onClick={() => set('italic', !style.italic)}
            title="Italic"
          >
            I
          </button>
          <button
            type="button"
            class={`chip ${style.borderStyle === 'opaque' ? 'chip-on' : ''}`}
            onClick={() =>
              set('borderStyle', style.borderStyle === 'opaque' ? 'outline' : 'opaque')
            }
            title="Opaque background box instead of text outline"
          >
            Box
          </button>
        </div>
      </div>
    </div>
  );
}

function clampInt(e: Event, min: number, max: number, fallback: number): number {
  const v = Number.parseInt((e.target as HTMLInputElement).value, 10);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, v));
}
