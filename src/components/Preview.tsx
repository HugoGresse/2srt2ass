import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Cue, Track, TrackStyle } from '../lib/types';
import { PLAY_RES_Y } from '../lib/types';
import { formatClock } from '../lib/time';
import { describeMkvFailure, diagnoseMkv, sniffMkvTracks } from '../lib/mkv';
import { FullscreenControls } from './FullscreenControls';
import { SubtitleText } from './SubtitleText';

export interface PreviewVideo {
  url: string;
  name: string;
  /** Original file, kept to sniff codecs when decoding fails. */
  file: File;
}

interface PreviewProps {
  bottom: Track | null;
  top: Track | null;
  video: PreviewVideo | null;
  onPickVideo: (files: FileList | null) => void;
  onRemoveVideo: () => void;
}

/**
 * Player rendering the merged subtitles with their ASS styles approximated
 * in CSS — over a simulated stage, or over a real local video file when one
 * is loaded (object URL; the file never leaves the machine). With a video,
 * the <video> element is the time authority; without, a rAF clock is.
 */
export function Preview({ bottom, top, video, onPickVideo, onRemoveVideo }: PreviewProps) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [audioWarning, setAudioWarning] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsAwake, setControlsAwake] = useState(true);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [stageHeight, setStageHeight] = useState(220);

  const canFullscreen =
    typeof document !== 'undefined' && document.fullscreenEnabled === true;

  const subtitleEnd = useMemo(() => {
    const ends = [
      ...(bottom?.cues ?? []).map((c) => c.end + (bottom?.shift ?? 0)),
      ...(top?.cues ?? []).map((c) => c.end + (top?.shift ?? 0)),
    ];
    return ends.length > 0 ? Math.max(...ends) : 0;
  }, [bottom, top]);

  const duration = Math.max(subtitleEnd, video && !videoError ? videoDuration : 0);

  // Cues are sorted by start, so the first one of each track is the earliest.
  const firstStart = useMemo(() => {
    const starts = [
      ...(bottom && bottom.cues.length > 0 ? [bottom.cues[0]!.start + bottom.shift] : []),
      ...(top && top.cues.length > 0 ? [top.cues[0]!.start + top.shift] : []),
    ];
    return starts.length > 0 ? Math.max(0, Math.min(...starts)) : 0;
  }, [bottom, top]);

  const seek = (t: number) => {
    setTime(t);
    const vid = videoRef.current;
    if (vid && vid.readyState > 0) vid.currentTime = t;
  };

  // Open on the first subtitle instead of an empty frame at 0:00; also
  // re-snap when loading/swapping/syncing moves it. Style edits don't.
  useEffect(() => {
    seek(firstStart);
  }, [firstStart]);

  // New video file: reset error state and align it with the current time.
  // Metadata may already be in (cached blob loads before this effect), so
  // read it directly instead of relying solely on the loadedmetadata event.
  useEffect(() => {
    setVideoError(null);
    setAudioWarning(null);
    setPlaying(false);
    const vid = videoRef.current;
    if (vid && vid.readyState >= 1 && Number.isFinite(vid.duration)) {
      setVideoDuration(vid.duration);
    } else {
      setVideoDuration(0);
    }
  }, [video?.url]);

  /** Decode failed: read the container header to name the actual culprit. */
  const explainVideoError = async () => {
    const fallback = 'This browser can’t decode that file — try an MP4/WebM, or Chrome for MKV.';
    if (!video) return;
    try {
      const head = await video.file.slice(0, 4 * 1024 * 1024).arrayBuffer();
      const tracks = sniffMkvTracks(head);
      setVideoError(tracks && tracks.length > 0 ? describeMkvFailure(diagnoseMkv(tracks)) : fallback);
    } catch {
      setVideoError(fallback);
    }
  };

  /** Video playing but no audio bytes decoded → codec-less audio track. */
  const checkSilentAudio = (vid: HTMLVideoElement) => {
    const decoded = (vid as HTMLVideoElement & { webkitAudioDecodedByteCount?: number })
      .webkitAudioDecodedByteCount;
    if (decoded === undefined || decoded > 0 || vid.paused || vid.muted) return;
    void video?.file
      .slice(0, 4 * 1024 * 1024)
      .arrayBuffer()
      .then((head) => {
        const tracks = sniffMkvTracks(head);
        if (!tracks) return; // non-MKV: can't tell "no audio" from "unsupported"
        const d = diagnoseMkv(tracks);
        if (!d.audioCodec) return; // file simply has no audio track
        setAudioWarning(
          `Video plays, but the ${d.audioCodec} audio track isn’t supported by this browser.`,
        );
      });
  };

  // Keep the CSS scale in sync with the rendered stage size.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setStageHeight(el.clientHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Track fullscreen state (Esc exits natively).
  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(document.fullscreenElement === stageRef.current);
      setControlsAwake(true);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Apply volume/mute to the video element.
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.volume = volume;
    vid.muted = muted;
  }, [volume, muted, video?.url]);

  /** Show the fullscreen controls, then let them fade while playing. */
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const wakeControls = () => {
    setControlsAwake(true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      // Never hide the controls while paused.
      if (playingRef.current) setControlsAwake(false);
    }, 2500);
  };

  // Paused → keep controls visible; unmount → clear the timer.
  useEffect(() => {
    if (!playing) {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      setControlsAwake(true);
    }
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [playing]);

  // Player keyboard shortcuts, fullscreen only.
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      const vid = videoRef.current;
      const step = (delta: number) =>
        seekRef.current(Math.max(0, Math.min(durationRef.current, timeRef.current + delta)));
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlayRef.current();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          step(-5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          step(5);
          break;
        case 'ArrowUp':
        case 'ArrowDown': {
          if (!vid) break;
          e.preventDefault();
          setMuted(false);
          setVolume((v) => Math.max(0, Math.min(1, v + (e.key === 'ArrowUp' ? 0.1 : -0.1))));
          break;
        }
        case 'm':
          setMuted((m) => !m);
          break;
        case 'f':
          void document.exitFullscreen();
          break;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  // Clock: follow the video when present, otherwise advance a rAF timer.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const vid = videoRef.current;
      if (vid && !videoError) {
        setTime(vid.currentTime);
        if (vid.ended) {
          setPlaying(false);
          return;
        }
      } else {
        const dt = (now - last) / 1000;
        last = now;
        let reachedEnd = false;
        setTime((t) => {
          const next = t + dt;
          if (next >= duration) {
            reachedEnd = true;
            return duration;
          }
          return next;
        });
        if (reachedEnd) {
          setPlaying(false);
          return;
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, duration, videoError]);

  const togglePlay = () => {
    const vid = videoRef.current;
    if (vid && !videoError) {
      if (vid.paused) void vid.play().catch(() => setPlaying(false));
      else vid.pause();
      // `playing` follows the element's play/pause events.
      return;
    }
    setPlaying((p) => !p);
  };

  // Always-fresh references for the fullscreen keyboard listener, which is
  // bound once per fullscreen session and must not capture stale closures.
  const timeRef = useRef(time);
  const durationRef = useRef(duration);
  const seekRef = useRef(seek);
  const togglePlayRef = useRef(togglePlay);
  timeRef.current = time;
  durationRef.current = duration;
  seekRef.current = seek;
  togglePlayRef.current = togglePlay;

  const scale = stageHeight / PLAY_RES_Y;
  const activeBottom = activeCues(bottom, time);
  const activeTop = activeCues(top, time);
  const hasVideo = video !== null && !videoError;

  const jump = (direction: 1 | -1) => {
    const starts = [
      ...(bottom?.cues ?? []).map((c) => c.start + (bottom?.shift ?? 0)),
      ...(top?.cues ?? []).map((c) => c.start + (top?.shift ?? 0)),
    ].sort((a, b) => a - b);
    if (starts.length === 0) return;
    const epsilon = 0.001;
    const target =
      direction === 1
        ? starts.find((s) => s > time + epsilon)
        : [...starts].reverse().find((s) => s < time - epsilon);
    if (target !== undefined) seek(Math.min(target + 0.01, duration));
  };

  return (
    <section class="preview" aria-label="Subtitle preview">
      {video && (
        <div class="preview-videobar">
          <span class="preview-videoname" title={video.name}>🎬 {video.name}</span>
          {videoError && <span class="preview-videoerror">{videoError}</span>}
          {!videoError && audioWarning && <span class="preview-videoerror">{audioWarning}</span>}
          <button type="button" class="btn btn-ghost btn-small" onClick={onRemoveVideo}>
            Remove video
          </button>
        </div>
      )}

      <div
        class={`preview-stage ${isFullscreen && !controlsAwake ? 'fs-idle' : ''}`}
        ref={stageRef}
        onPointerMove={isFullscreen ? wakeControls : undefined}
        onClick={isFullscreen ? togglePlay : undefined}
      >
        {video && (
          <video
            ref={videoRef}
            class="preview-video"
            src={video.url}
            playsinline
            preload="metadata"
            onLoadedMetadata={(e) => {
              const vid = e.target as HTMLVideoElement;
              setVideoDuration(vid.duration);
              vid.currentTime = time;
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => {
              // Keeps the clock moving when rAF is throttled (hidden tab).
              const vid = e.target as HTMLVideoElement;
              if (!vid.paused) setTime(vid.currentTime);
              if (audioWarning === null && vid.currentTime > 1) checkSilentAudio(vid);
            }}
            onError={() => void explainVideoError()}
          />
        )}
        {!hasVideo && <div class="preview-vignette" aria-hidden="true" />}
        {activeTop.length + activeBottom.length === 0 && !hasVideo && (
          <p class="preview-empty">
            {duration === 0 ? 'Load a subtitle file to preview it here' : 'No subtitle at this time'}
          </p>
        )}
        {top && activeTop.length > 0 && (
          <div class="preview-line preview-line-top" style={lineStyle(top.style, scale)}>
            {activeTop.map((cue) => (
              <div key={cue.index}>
                <span style={textSpanStyle(top.style, scale)}>
                  <SubtitleText text={cue.text} />
                </span>
              </div>
            ))}
          </div>
        )}
        {bottom && activeBottom.length > 0 && (
          <div class="preview-line preview-line-bottom" style={lineStyle(bottom.style, scale)}>
            {activeBottom.map((cue) => (
              <div key={cue.index}>
                <span style={textSpanStyle(bottom.style, scale)}>
                  <SubtitleText text={cue.text} />
                </span>
              </div>
            ))}
          </div>
        )}
        {isFullscreen && (
          <FullscreenControls
            visible={controlsAwake}
            playing={playing}
            time={time}
            duration={duration}
            hasAudio={hasVideo}
            volume={volume}
            muted={muted}
            onTogglePlay={togglePlay}
            onSeek={seek}
            onJump={jump}
            onVolume={(v) => {
              setMuted(false);
              setVolume(v);
            }}
            onToggleMute={() => setMuted((m) => !m)}
            onExit={() => void document.exitFullscreen()}
          />
        )}
      </div>

      <div class="preview-controls">
        <button
          type="button"
          class="btn btn-icon"
          onClick={togglePlay}
          disabled={duration === 0}
          aria-label={playing ? 'Pause' : 'Play'}
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <button
          type="button"
          class="btn btn-icon"
          onClick={() => jump(-1)}
          disabled={duration === 0}
          aria-label="Previous subtitle"
          title="Previous subtitle"
        >
          ⇤
        </button>
        <button
          type="button"
          class="btn btn-icon"
          onClick={() => jump(1)}
          disabled={duration === 0}
          aria-label="Next subtitle"
          title="Next subtitle"
        >
          ⇥
        </button>
        <input
          type="range"
          class="preview-scrub"
          min={0}
          max={Math.max(duration, 0.1)}
          step={0.05}
          value={time}
          disabled={duration === 0}
          onInput={(e) => seek(Number.parseFloat((e.target as HTMLInputElement).value))}
          aria-label="Timeline"
        />
        <span class="preview-clock">
          {formatClock(time)} / {formatClock(duration)}
        </span>
        {canFullscreen && (
          <button
            type="button"
            class="btn btn-icon"
            onClick={() => void stageRef.current?.requestFullscreen()}
            disabled={duration === 0}
            aria-label="Fullscreen player"
            title="Fullscreen player"
          >
            ⛶
          </button>
        )}
        {!video && (
          <label class="btn btn-ghost btn-small preview-loadvideo" title="Preview over a real video file (stays on your machine)">
            <input
              type="file"
              accept="video/*,.mp4,.m4v,.webm,.mkv,.mov,.ogv"
              hidden
              onChange={(e) => {
                onPickVideo((e.target as HTMLInputElement).files);
                (e.target as HTMLInputElement).value = '';
              }}
            />
            🎬 Video…
          </label>
        )}
      </div>
    </section>
  );
}

function activeCues(track: Track | null, time: number): Cue[] {
  if (!track) return [];
  const t = time - track.shift;
  return track.cues.filter((c) => c.start <= t && t <= c.end);
}

function lineStyle(style: TrackStyle, scale: number) {
  const margin = `${Math.round(style.marginV * scale)}px`;
  return style.position === 'top' ? { top: margin } : { bottom: margin };
}

function textSpanStyle(style: TrackStyle, scale: number) {
  const size = Math.max(9, style.fontSize * scale);
  const base = {
    fontFamily: `${style.fontName}, sans-serif`,
    fontSize: `${size.toFixed(1)}px`,
    fontWeight: style.bold ? 700 : 400,
    fontStyle: style.italic ? 'italic' : 'normal',
    color: style.primaryColor,
    lineHeight: 1.25,
  };
  if (style.borderStyle === 'opaque') {
    return {
      ...base,
      background: hexToRgba(style.backColor, 0.5),
      boxDecorationBreak: 'clone' as const,
      padding: `${(1 * scale).toFixed(1)}px ${(4 * scale).toFixed(1)}px`,
    };
  }
  return { ...base, textShadow: outlineShadow(style.outlineColor, style.outlineWidth * scale * 0.6) };
}

/** Approximate an ASS outline with an 8-direction text-shadow ring. */
function outlineShadow(color: string, radius: number): string {
  const r = Math.max(0.5, radius).toFixed(1);
  const d = (Math.max(0.5, radius) * 0.7071).toFixed(1);
  return [
    `${r}px 0 0 ${color}`,
    `-${r}px 0 0 ${color}`,
    `0 ${r}px 0 ${color}`,
    `0 -${r}px 0 ${color}`,
    `${d}px ${d}px 0 ${color}`,
    `-${d}px ${d}px 0 ${color}`,
    `${d}px -${d}px 0 ${color}`,
    `-${d}px -${d}px 0 ${color}`,
  ].join(', ');
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return `rgba(0,0,0,${alpha})`;
  const n = Number.parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
