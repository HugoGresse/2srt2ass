import { useState } from 'preact/hooks';
import { ENCODING_GROUPS } from '../lib/encoding';
import { cuesDuration } from '../lib/srt';
import { formatClock } from '../lib/time';
import type { TrackPosition } from '../lib/types';
import type { LoadedTrack } from './state';
import { StyleEditor } from './StyleEditor';

interface TrackCardProps {
  position: TrackPosition;
  track: LoadedTrack | null;
  onPickFile: (files: FileList | null) => void;
  onRemove: () => void;
  onChange: (track: LoadedTrack) => void;
  onEncodingChange: (encoding: string) => void;
}

/** Card for one subtitle slot: file info, encoding, shift and style. */
export function TrackCard({
  position,
  track,
  onPickFile,
  onRemove,
  onChange,
  onEncodingChange,
}: TrackCardProps) {
  const [showStyle, setShowStyle] = useState(false);
  const label = position === 'bottom' ? 'Bottom' : 'Top';
  const hint =
    position === 'bottom' ? 'usually the original language' : 'usually your translation';

  if (!track) {
    return (
      <div class={`track-card track-card-empty track-${position}`}>
        <div class="track-head">
          <h3>
            <span class={`track-dot track-dot-${position}`} aria-hidden="true" />
            {label} subtitles
          </h3>
        </div>
        <label class="track-drop">
          <input
            type="file"
            accept=".srt,.vtt,.txt"
            hidden
            onChange={(e) => onPickFile((e.target as HTMLInputElement).files)}
          />
          <span class="track-drop-cta">Choose an SRT file</span>
          <span class="track-drop-hint">or drop it anywhere on the page — {hint}</span>
        </label>
      </div>
    );
  }

  const { parse } = track;
  const duration = cuesDuration(parse.cues);

  return (
    <div class={`track-card track-${position}`}>
      <div class="track-head">
        <h3>
          <span class={`track-dot track-dot-${position}`} aria-hidden="true" />
          {label} subtitles
        </h3>
        <button type="button" class="btn btn-ghost btn-small" onClick={onRemove}>
          Remove
        </button>
      </div>

      <p class="track-file" title={track.fileName}>
        {track.fileName}
      </p>
      <p class="track-stats">
        {parse.cues.length} cue{parse.cues.length === 1 ? '' : 's'} · ends at{' '}
        {formatClock(duration)}
        {parse.format === 'vtt' ? ' · WebVTT' : ''}
      </p>

      {!track.encodingConfident && (
        <p class="track-warning">
          Encoding guessed as Windows-1252 — override below if accents look wrong.
        </p>
      )}
      {parse.warnings.length > 0 && (
        <details class="track-warnings">
          <summary>
            {parse.warnings.length} parsing note{parse.warnings.length > 1 ? 's' : ''}
          </summary>
          <ul>
            {parse.warnings.slice(0, 8).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}

      <div class="track-options">
        <label class="field">
          <span>Encoding</span>
          <select
            value={track.encoding}
            onChange={(e) => onEncodingChange((e.target as HTMLSelectElement).value)}
          >
            {ENCODING_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.encodings.map((enc) => (
                  <option key={enc.value} value={enc.value}>
                    {enc.label}
                    {enc.value === track.detectedEncoding ? ' (detected)' : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label class="field field-narrow">
          <span>Shift (s)</span>
          <input
            type="number"
            step={0.1}
            value={track.shift}
            onInput={(e) => {
              const v = Number.parseFloat((e.target as HTMLInputElement).value);
              onChange({ ...track, shift: Number.isFinite(v) ? v : 0 });
            }}
            title="Delay (positive) or advance (negative) this track, in seconds"
          />
        </label>

        <button
          type="button"
          class={`btn btn-ghost btn-small track-style-toggle ${showStyle ? 'is-open' : ''}`}
          onClick={() => setShowStyle((s) => !s)}
        >
          {showStyle ? 'Hide style' : 'Style…'}
        </button>
      </div>

      {showStyle && (
        <StyleEditor style={track.style} onChange={(style) => onChange({ ...track, style })} />
      )}
    </div>
  );
}
