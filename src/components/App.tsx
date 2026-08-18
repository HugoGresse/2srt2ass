import { useCallback, useMemo, useState } from 'preact/hooks';
import { buildAss } from '../lib/ass';
import { outputFilename } from '../lib/download';
import type { TrackPosition } from '../lib/types';
import { defaultScriptOptions } from '../lib/types';
import { Dropzone } from './Dropzone';
import { OutputPanel } from './OutputPanel';
import { Preview } from './Preview';
import { SyncPanel } from './SyncPanel';
import { TrackCard } from './TrackCard';
import {
  isSubtitleFile,
  loadTrackFromFile,
  planFileAssignment,
  reencodeTrack,
  swapTracks,
  toAssTrack,
  type AppState,
  type LoadedTrack,
} from './state';

/** Root island: all state lives here; everything below is presentational. */
export function App() {
  const [state, setState] = useState<AppState>({ bottom: null, top: null });
  const [customFilename, setCustomFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Load one file into a specific slot. */
  const loadInto = useCallback((position: TrackPosition, file: File) => {
    void loadTrackFromFile(file, position).then((track) => {
      setState((s) => ({ ...s, [position]: track }));
      if (position === 'bottom') setCustomFilename(null);
    });
  }, []);

  /** Dropped or browsed files without an explicit slot: plan the assignment. */
  const addFiles = useCallback(
    (incoming: File[]) => {
      const files = incoming.filter(isSubtitleFile);
      if (files.length === 0) {
        setError('That doesn’t look like a subtitle file — expected .srt or .vtt.');
        return;
      }
      setError(null);
      setState((prev) => {
        planFileAssignment(prev, files.length).forEach((position, i) =>
          loadInto(position, files[i]!),
        );
        return prev;
      });
    },
    [loadInto],
  );

  const pickFileFor = (position: TrackPosition) => (files: FileList | null) => {
    const file = files ? Array.from(files).find(isSubtitleFile) : undefined;
    if (!file) {
      if (files && files.length > 0) {
        setError('That doesn’t look like a subtitle file — expected .srt or .vtt.');
      }
      return;
    }
    setError(null);
    loadInto(position, file);
  };

  const setTrack = (position: TrackPosition) => (track: LoadedTrack) =>
    setState((s) => ({ ...s, [position]: track }));

  const removeTrack = (position: TrackPosition) => () =>
    setState((s) => ({ ...s, [position]: null }));

  const changeEncoding = (position: TrackPosition) => (encoding: string) =>
    setState((s) => {
      const track = s[position];
      return track ? { ...s, [position]: reencodeTrack(track, encoding) } : s;
    });

  const bottomAss = toAssTrack(state.bottom);
  const topAss = toAssTrack(state.top);
  const hasAny = state.bottom !== null || state.top !== null;

  const filename =
    customFilename ?? outputFilename(state.bottom?.fileName ?? state.top?.fileName ?? null);

  const assText = useMemo(() => {
    if (!bottomAss && !topAss) return '';
    return buildAss(bottomAss, topAss, defaultScriptOptions(filename.replace(/\.ass$/i, '')));
  }, [bottomAss, topAss, filename]);

  return (
    <div class="app">
      <Dropzone onFiles={addFiles} />

      {error && (
        <p class="app-error" role="alert">
          {error}
          <button type="button" class="btn btn-ghost btn-small" onClick={() => setError(null)}>
            Dismiss
          </button>
        </p>
      )}

      {!hasAny ? (
        <label class="hero-drop">
          <input
            type="file"
            accept=".srt,.vtt,.txt"
            multiple
            hidden
            onChange={(e) => {
              const files = (e.target as HTMLInputElement).files;
              if (files) addFiles(Array.from(files));
              (e.target as HTMLInputElement).value = '';
            }}
          />
          <span class="hero-drop-icon" aria-hidden="true">⬆</span>
          <span class="hero-drop-title">Drop one or two SRT files anywhere</span>
          <span class="hero-drop-sub">
            or click to browse — files never leave your browser
          </span>
        </label>
      ) : (
        <div class="workspace">
          <div class="workspace-tracks">
            <TrackCard
              position="bottom"
              track={state.bottom}
              onPickFile={pickFileFor('bottom')}
              onRemove={removeTrack('bottom')}
              onChange={setTrack('bottom')}
              onEncodingChange={changeEncoding('bottom')}
            />
            {state.bottom && state.top && (
              <button
                type="button"
                class="btn btn-ghost btn-swap"
                onClick={() => setState(swapTracks)}
                title="Swap top and bottom tracks"
              >
                ⇅ Swap tracks
              </button>
            )}
            <TrackCard
              position="top"
              track={state.top}
              onPickFile={pickFileFor('top')}
              onRemove={removeTrack('top')}
              onChange={setTrack('top')}
              onEncodingChange={changeEncoding('top')}
            />
            {state.bottom && state.top && (
              <SyncPanel
                top={state.top}
                bottom={state.bottom}
                onShiftTop={(shift) =>
                  setState((s) => (s.top ? { ...s, top: { ...s.top, shift } } : s))
                }
              />
            )}
          </div>

          <div class="workspace-output">
            <Preview bottom={bottomAss} top={topAss} />
            {assText !== '' && (
              <OutputPanel
                assText={assText}
                filename={filename}
                onFilenameChange={setCustomFilename}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
