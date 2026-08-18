import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Cue, Track, TrackStyle } from '../lib/types';
import { PLAY_RES_Y } from '../lib/types';
import { formatClock } from '../lib/time';
import { SubtitleText } from './SubtitleText';

interface PreviewProps {
  bottom: Track | null;
  top: Track | null;
}

/**
 * Simulated video player: scrubbable timeline rendering the merged subtitles
 * with their ASS styles approximated in CSS.
 */
export function Preview({ bottom, top }: PreviewProps) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageHeight, setStageHeight] = useState(220);

  const duration = useMemo(() => {
    const ends = [
      ...(bottom?.cues ?? []).map((c) => c.end + (bottom?.shift ?? 0)),
      ...(top?.cues ?? []).map((c) => c.end + (top?.shift ?? 0)),
    ];
    return ends.length > 0 ? Math.max(...ends) : 0;
  }, [bottom, top]);

  // Keep the CSS scale in sync with the rendered stage size.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setStageHeight(el.clientHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setTime((t) => {
        const next = t + dt;
        if (next >= duration) {
          setPlaying(false);
          return duration;
        }
        return next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, duration]);

  const scale = stageHeight / PLAY_RES_Y;
  const activeBottom = activeCues(bottom, time);
  const activeTop = activeCues(top, time);

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
    if (target !== undefined) setTime(Math.min(target + 0.01, duration));
  };

  return (
    <section class="preview" aria-label="Subtitle preview">
      <div class="preview-stage" ref={stageRef}>
        <div class="preview-vignette" aria-hidden="true" />
        {activeTop.length + activeBottom.length === 0 && (
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
          onClick={() => setPlaying((p) => !p)}
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
          onInput={(e) => {
            setPlaying(false);
            setTime(Number.parseFloat((e.target as HTMLInputElement).value));
          }}
          aria-label="Timeline"
        />
        <span class="preview-clock">
          {formatClock(time)} / {formatClock(duration)}
        </span>
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
