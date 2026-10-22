import { describe, expect, it } from 'vitest';
import { clampFrame, frameToTime, frameToTimecode, mediaTimeToFrame, timeToFrame } from './frameController';
import { containRect, drawingsAtFrame, simplify } from './annotations';

describe('frame <-> time', () => {
  for (const fps of [24, 25, 30, 24000 / 1001, 30000 / 1001, 60]) {
    it(`round-trips every frame at ${fps.toFixed(3)} fps`, () => {
      for (let i = 0; i < 5000; i += 7) {
        // Seek targets land mid-frame; presentation timestamps are the frame start.
        expect(timeToFrame(frameToTime(i, fps), fps)).toBe(i);
        expect(mediaTimeToFrame(i / fps, fps)).toBe(i);
        expect(timeToFrame(i / fps, fps)).toBe(i);
      }
    });
  }
  it('clamps to the clip', () => {
    expect(clampFrame(-3, 10)).toBe(0);
    expect(clampFrame(12, 10)).toBe(9);
    expect(clampFrame(NaN, 10)).toBe(0);
  });
  it('formats timecode', () => {
    expect(frameToTimecode(0, 24)).toBe('00:00:00:00');
    expect(frameToTimecode(24 * 61 + 5, 24)).toBe('00:01:01:05');
    expect(frameToTimecode(24 * 3600, 24)).toBe('01:00:00:00');
  });
});

describe('annotations', () => {
  it('fits the picture inside a letterboxed box', () => {
    const r = containRect(1000, 1000, 1920, 1080);
    expect(r.x).toBeCloseTo(0, 6);
    expect(r.y).toBeCloseTo(218.75, 6);
    expect(r.w).toBeCloseTo(1000, 6);
    expect(r.h).toBeCloseTo(562.5, 6);
    expect(containRect(1000, 400, 1920, 1080).x).toBeCloseTo(144.44, 1);
  });
  it('shows drawings only on their frames', () => {
    const d = { shapes: [{ tool: 'pen', points: [[0, 0]] }] };
    const notes = [
      { id: 'a', frame: 1010, drawing: d },
      { id: 'b', frame: 1012, frame_end: 1015, drawing: d },
      { id: 'c', frame: 1012 },
    ];
    expect(drawingsAtFrame(notes, 1010).map((n) => n.id)).toEqual(['a']);
    expect(drawingsAtFrame(notes, 1014).map((n) => n.id)).toEqual(['b']);
    expect(drawingsAtFrame(notes, 1016)).toEqual([]);
  });
  it('simplifies pen strokes but keeps the ends', () => {
    const pts = Array.from({ length: 200 }, (_, i) => [i / 100000, 0.5]);
    const out = simplify(pts);
    expect(out.length).toBeLessThan(10);
    expect(out[0]).toEqual([0, 0.5]);
    expect(out[out.length - 1][0]).toBeCloseTo(199 / 100000, 4);
  });
});

import { describeSequence, frameNumber } from '../components/review/SubmitDialog';

describe('image sequence detection', () => {
  const f = (name) => ({ name, size: 1 });
  it('reads frame numbers from names', () => {
    expect(frameNumber('sh010.1012.exr')).toBe(1012);
    expect(frameNumber('frame_0007.png')).toBe(7);
    expect(frameNumber('v2_sh010_1012.png')).toBe(1012);
    expect(frameNumber('cover.png')).toBe(null);
  });
  it('describes a sequence and its gaps', () => {
    const s = describeSequence([f('a.1001.png'), f('a.1002.png'), f('a.1004.png')]);
    expect(s).toEqual({ count: 3, first: 1001, last: 1004, pattern: 'a.####.png', missing: 1 });
    expect(describeSequence([f('a.mov')])).toBe(null);
    expect(describeSequence([f('a.1.png'), f('b.png')]).error).toMatch(/frame number/);
  });
});
