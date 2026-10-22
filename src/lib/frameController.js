/**
 * Frame-accurate control of an HTMLVideoElement.
 *
 * Browsers expose video time in seconds, not frames, and `currentTime` after a pause or a
 * seek does not reliably say which frame is on screen. This controller works in frame
 * indices (0-based) and only reports a frame once the browser has actually presented it:
 *
 * - Seeking to frame i targets the middle of its display interval, (i + 0.5) / fps, so
 *   rounding in the decoder can never land on a neighbour.
 * - The presented frame comes from requestVideoFrameCallback's `mediaTime` (the exact
 *   presentation timestamp), falling back to `currentTime` on browsers without it.
 * - Pausing snaps to the last presented frame, so "pause, then step" never skips a frame.
 *
 * Proxies are encoded at a constant frame rate starting at t=0 (see zeno-api reviews/media.py),
 * which is what makes the frame <-> time mapping exact.
 */

const EPS = 1e-4;

export function frameToTime(index, fps) {
  return (index + 0.5) / fps;
}

/** Frame whose display interval contains `t` (currentTime-style). */
export function timeToFrame(t, fps) {
  return Math.floor(t * fps + EPS);
}

/** Frame whose presentation timestamp is `mediaTime` (requestVideoFrameCallback-style). */
export function mediaTimeToFrame(mediaTime, fps) {
  return Math.round(mediaTime * fps);
}

export function clampFrame(index, frameCount) {
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(0, Math.round(index)), Math.max(0, frameCount - 1));
}

/** "HH:MM:SS:FF" timecode for a 0-based frame index at a (possibly fractional) fps. */
export function frameToTimecode(index, fps) {
  const base = Math.round(fps);
  const ff = index % base;
  const totalSeconds = Math.floor(index / base);
  const ss = totalSeconds % 60;
  const mm = Math.floor(totalSeconds / 60) % 60;
  const hh = Math.floor(totalSeconds / 3600);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(hh)}:${p(mm)}:${p(ss)}:${p(ff)}`;
}

export function createFrameController(video, { fps, frameCount, onFrame } = {}) {
  const hasRvfc = typeof video.requestVideoFrameCallback === 'function';
  let current = 0;
  let rvfcHandle = null;
  let rafHandle = null;
  let loop = null; // { in, out } inclusive frame range, or null
  let reverseTimer = null;
  let pendingSeek = null; // { target, resolve, tries }
  let lastPresented = null; // frame the browser last actually painted (rVFC)
  let queuedTarget = null; // newest target requested while a seek was in flight
  let destroyed = false;

  const emit = (frame) => {
    if (frame === current && !pendingSeek) return;
    current = frame;
    if (pendingSeek && frame === pendingSeek.target) {
      const { resolve } = pendingSeek;
      pendingSeek = null;
      resolve(frame);
    }
    onFrame?.(frame);
  };

  const presented = (frame) => {
    const f = clampFrame(frame, frameCount);
    if (loop && !video.paused && f >= loop.out) {
      video.currentTime = frameToTime(loop.in, fps);
    }
    emit(f);
  };

  const watch = () => {
    if (destroyed) return;
    if (hasRvfc) {
      rvfcHandle = video.requestVideoFrameCallback((_now, meta) => {
        lastPresented = clampFrame(mediaTimeToFrame(meta.mediaTime, fps), frameCount);
        presented(lastPresented);
        watch();
      });
    } else {
      rafHandle = requestAnimationFrame(() => {
        presented(timeToFrame(video.currentTime, fps));
        watch();
      });
    }
  };

  const issue = (target) => {
    video.currentTime = frameToTime(target, fps);
  };

  // A seek issued right after another one lands (before the browser paints) completes in
  // Safari without ever painting, so the screen keeps the old frame. After every seek we
  // "settle" for two animation frames; seeks requested meanwhile are coalesced into one.
  let settling = false;
  const busy = () => video.seeking || settling;

  const onSeeked = () => {
    settling = true;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        settling = false;
        if (queuedTarget !== null) {
          const next = queuedTarget;
          queuedTarget = null;
          issue(next);
          return;
        }
        const p = pendingSeek;
        if (!p || video.seeking || !video.paused) return;
        // Without rVFC the settled seek is the only signal that the new frame is up.
        if (!hasRvfc) {
          presented(timeToFrame(video.currentTime, fps));
          return;
        }
        // rVFC normally confirmed the frame already. It stays silent when the target was
        // already on screen; then, or if a paint was lost, bounce via a neighbour and back.
        if (lastPresented === p.target) {
          emit(p.target);
        } else if (p.tries < 3) {
          p.tries += 1;
          queuedTarget = p.target;
          issue(p.target > 0 ? p.target - 1 : p.target + 1);
        } else {
          emit(timeToFrame(video.currentTime, fps));
        }
      })
    );
  };

  const onPause = () => {
    // currentTime runs slightly ahead of the presented frame; re-seat on what was shown.
    // Not while a seek is pending: the pause event arrives after seek() set its target.
    if (reverseTimer || pendingSeek) return;
    video.currentTime = frameToTime(current, fps);
  };

  video.addEventListener('seeked', onSeeked);
  video.addEventListener('pause', onPause);
  watch();

  const stopReverse = () => {
    if (reverseTimer) {
      clearInterval(reverseTimer);
      reverseTimer = null;
    }
  };

  const api = {
    get frame() {
      return current;
    },
    get frameCount() {
      return frameCount;
    },
    get fps() {
      return fps;
    },
    get playing() {
      return !video.paused || reverseTimer !== null;
    },
    get loop() {
      return loop;
    },

    /** Show frame `index`; resolves with the frame once it is on screen. */
    seek(index) {
      const target = clampFrame(index, frameCount);
      stopReverse();
      if (!video.paused) video.pause();
      if (pendingSeek) pendingSeek.resolve(current);
      return new Promise((resolve) => {
        pendingSeek = { target, resolve, tries: 0 };
        if (busy()) queuedTarget = target;
        else issue(target);
      });
    },

    step(delta = 1) {
      const base = pendingSeek ? pendingSeek.target : current;
      return api.seek(base + delta);
    },

    play() {
      stopReverse();
      if (loop && (current < loop.in || current >= loop.out)) {
        video.currentTime = frameToTime(loop.in, fps);
      } else if (current >= frameCount - 1) {
        video.currentTime = frameToTime(0, fps);
      }
      return video.play();
    },

    pause() {
      stopReverse();
      video.pause();
    },

    toggle() {
      return api.playing ? api.pause() : api.play();
    },

    /** Reverse playback by stepping; smooth for short-GOP proxies. */
    playReverse(rate = 1) {
      if (!video.paused) video.pause();
      stopReverse();
      reverseTimer = setInterval(() => {
        const lower = loop ? loop.in : 0;
        const upper = loop ? loop.out : frameCount - 1;
        const next = current - 1 < lower ? upper : current - 1;
        video.currentTime = frameToTime(next, fps);
      }, 1000 / (fps * rate));
    },

    setRate(rate) {
      video.playbackRate = rate;
    },

    /** Loop between two inclusive frame indices; null clears it. */
    setLoop(range) {
      if (!range) {
        loop = null;
        return;
      }
      const a = clampFrame(range.in, frameCount);
      const b = clampFrame(range.out, frameCount);
      loop = { in: Math.min(a, b), out: Math.max(a, b) };
    },

    destroy() {
      destroyed = true;
      stopReverse();
      if (rvfcHandle !== null && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(rvfcHandle);
      if (rafHandle !== null) cancelAnimationFrame(rafHandle);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('pause', onPause);
      if (pendingSeek) pendingSeek.resolve(current);
      pendingSeek = null;
    },
  };
  return api;
}
