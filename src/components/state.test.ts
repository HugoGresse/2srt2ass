import { describe, expect, it } from 'vitest';
import { isSubtitleFile, isVideoFile, planFileAssignment } from './state';

const file = (name: string, type = '') => new File([''], name, { type });

describe('file routing', () => {
  it('recognizes subtitle files by extension', () => {
    expect(isSubtitleFile(file('movie.en.srt'))).toBe(true);
    expect(isSubtitleFile(file('movie.vtt'))).toBe(true);
    expect(isSubtitleFile(file('movie.mp4'))).toBe(false);
  });

  it('recognizes video files by extension or mime type', () => {
    expect(isVideoFile(file('movie.mkv'))).toBe(true);
    expect(isVideoFile(file('movie.mp4', 'video/mp4'))).toBe(true);
    expect(isVideoFile(file('clip.weird', 'video/x-something'))).toBe(true);
    expect(isVideoFile(file('movie.srt'))).toBe(false);
  });
});

describe('planFileAssignment', () => {
  const state = (bottom: boolean, top: boolean) =>
    ({ bottom: bottom ? ({} as never) : null, top: top ? ({} as never) : null });

  it('fills bottom first, then top', () => {
    expect(planFileAssignment(state(false, false), 2)).toEqual(['bottom', 'top']);
    expect(planFileAssignment(state(false, false), 1)).toEqual(['bottom']);
  });

  it('fills the free slot when one is taken', () => {
    expect(planFileAssignment(state(true, false), 1)).toEqual(['top']);
    expect(planFileAssignment(state(false, true), 1)).toEqual(['bottom']);
  });

  it('replaces bottom when both are taken, and caps at two files', () => {
    expect(planFileAssignment(state(true, true), 1)).toEqual(['bottom']);
    expect(planFileAssignment(state(false, false), 5)).toEqual(['bottom', 'top']);
  });
});
