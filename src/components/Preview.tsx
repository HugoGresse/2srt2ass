import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Cue, Track, TrackStyle } from '../lib/types';
import { PLAY_RES_Y } from '../lib/types';
import { formatClock } from '../lib/time';
import { SubtitleText } from './SubtitleText';

export interface PreviewVideo {
  url: string;
  name: string;
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
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stageHeight, setStageHeight] = useState(220);

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
    setPlaying(false);
    const vid = videoRef.current;
    if (vid && vid.readyState >= 1 && Number.isFinite(vid.duration)) {
      setVideoDuration(vid.duration);
    } else {
      setVideoDuration(0);
    }
  }, [video?.url]);

  // Keep the CSS scale in sync with the rendered stage size.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setStageHeight(el.clientHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
          <button type="button" class="btn btn-ghost btn-small" onClick={onRemoveVideo}>
            Remove video
          </button>
        </div>
      )}

      <div class="preview-stage" ref={stageRef}>
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
              if (!(e.target as HTMLVideoElement).paused) {
                setTime((e.target as HTMLVideoElement).currentTime);
              }
            }}
            onError={() =>
              setVideoError(
                'This browser can’t decode that file — try an MP4/WebM, or Chrome for MKV.',
              )
            }
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
