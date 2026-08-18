import { formatClock } from '../lib/time';

interface FullscreenControlsProps {
  visible: boolean;
  playing: boolean;
  time: number;
  duration: number;
  hasAudio: boolean;
  volume: number;
  muted: boolean;
  onTogglePlay: () => void;
  onSeek: (t: number) => void;
  onJump: (direction: 1 | -1) => void;
  onVolume: (v: number) => void;
  onToggleMute: () => void;
  onExit: () => void;
}

/** Overlay control bar shown while the preview stage is fullscreen. */
export function FullscreenControls({
  visible,
  playing,
  time,
  duration,
  hasAudio,
  volume,
  muted,
  onTogglePlay,
  onSeek,
  onJump,
  onVolume,
  onToggleMute,
  onExit,
}: FullscreenControlsProps) {
  return (
    <div
      class={`fs-controls ${visible ? '' : 'fs-controls-hidden'}`}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="range"
        class="fs-scrub"
        min={0}
        max={Math.max(duration, 0.1)}
        step={0.05}
        value={time}
        onInput={(e) => onSeek(Number.parseFloat((e.target as HTMLInputElement).value))}
        aria-label="Timeline"
      />
      <div class="fs-buttons">
        <button type="button" class="fs-btn" onClick={onTogglePlay} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? '❚❚' : '▶'}
        </button>
        <button type="button" class="fs-btn" onClick={() => onJump(-1)} aria-label="Previous subtitle" title="Previous subtitle">
          ⇤
        </button>
        <button type="button" class="fs-btn" onClick={() => onJump(1)} aria-label="Next subtitle" title="Next subtitle">
          ⇥
        </button>
        <span class="fs-clock">
          {formatClock(time)} / {formatClock(duration)}
        </span>
        <span class="fs-spacer" />
        {hasAudio && (
          <>
            <button type="button" class="fs-btn" onClick={onToggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
              {muted || volume === 0 ? '🔇' : '🔊'}
            </button>
            <input
              type="range"
              class="fs-volume"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onInput={(e) => onVolume(Number.parseFloat((e.target as HTMLInputElement).value))}
              aria-label="Volume"
            />
          </>
        )}
        <button type="button" class="fs-btn" onClick={onExit} aria-label="Exit fullscreen" title="Exit fullscreen (Esc)">
          ✕
        </button>
      </div>
    </div>
  );
}
