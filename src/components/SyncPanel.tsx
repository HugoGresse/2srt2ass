import { useState } from 'preact/hooks';
import { autoSync, shiftFromPair } from '../lib/sync';
import { formatClock } from '../lib/time';
import type { Cue } from '../lib/types';
import type { LoadedTrack } from './state';

interface SyncPanelProps {
  top: LoadedTrack;
  bottom: LoadedTrack;
  onShiftTop: (shift: number) => void;
}

/**
 * Synchronize the top track against the bottom one — automatically (ported
 * alignment search) or by declaring two cues to be the same line.
 */
export function SyncPanel({ top, bottom, onShiftTop }: SyncPanelProps) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [topPick, setTopPick] = useState(0);
  const [bottomPick, setBottomPick] = useState(0);
  const [showManual, setShowManual] = useState(false);

  const runAutoSync = () => {
    setBusy(true);
    setResult(null);
    // Let the button repaint before the scan hogs the main thread.
    setTimeout(() => {
      const sync = autoSync(top.parse.cues, bottom.parse.cues);
      const total = Math.round((top.shift + sync.shift) * 100) / 100;
      onShiftTop(total);
      const improved = sync.distance < sync.baseline * 0.98;
      setResult(
        improved || sync.shift !== 0
          ? `Shifted top by ${sync.shift >= 0 ? '+' : ''}${sync.shift.toFixed(2)} s (total ${total >= 0 ? '+' : ''}${total.toFixed(2)} s).`
          : 'Tracks already look aligned — no shift applied.',
      );
      setBusy(false);
    }, 30);
  };

  const applyManual = () => {
    const delta = shiftFromPair(top.parse.cues, bottom.parse.cues, topPick, bottomPick);
    if (delta === null) return;
    const total = Math.round((top.shift + delta) * 100) / 100;
    onShiftTop(total);
    setResult(
      `Matched the two lines: top shifted by ${delta >= 0 ? '+' : ''}${delta.toFixed(2)} s (total ${total >= 0 ? '+' : ''}${total.toFixed(2)} s).`,
    );
  };

  return (
    <section class="sync-panel" aria-label="Synchronization">
      <div class="sync-actions">
        <button type="button" class="btn" onClick={runAutoSync} disabled={busy}>
          {busy ? 'Scanning alignments…' : '🪄 Auto-sync top to bottom'}
        </button>
        <button
          type="button"
          class="btn btn-ghost"
          onClick={() => setShowManual((s) => !s)}
        >
          {showManual ? 'Hide manual sync' : 'Manual sync…'}
        </button>
        {result && <p class="sync-result">{result}</p>}
      </div>

      {showManual && (
        <div class="sync-manual">
          <p class="sync-manual-hint">
            Pick one line from each file that should appear at the same moment:
          </p>
          <div class="sync-selects">
            <label class="field">
              <span>Top line</span>
              <CuePicker cues={top.parse.cues} value={topPick} onChange={setTopPick} />
            </label>
            <label class="field">
              <span>Bottom line</span>
              <CuePicker cues={bottom.parse.cues} value={bottomPick} onChange={setBottomPick} />
            </label>
            <button type="button" class="btn" onClick={applyManual}>
              Align these two
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function CuePicker({
  cues,
  value,
  onChange,
}: {
  cues: Cue[];
  value: number;
  onChange: (index: number) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number.parseInt((e.target as HTMLSelectElement).value, 10))}
    >
      {cues.slice(0, 2000).map((cue, i) => (
        <option key={i} value={i}>
          {formatClock(cue.start)} · {excerpt(cue.text)}
        </option>
      ))}
    </select>
  );
}

function excerpt(text: string): string {
  const flat = text.replace(/<[^>]*>/g, '').replace(/\n/g, ' ');
  return flat.length > 48 ? `${flat.slice(0, 48)}…` : flat;
}
