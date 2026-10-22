import { useLayoutEffect, useRef, useState } from 'react';

export const NOTE_COLORS = {
  open: '#ef4444',
  fixed: '#fbbf24',
  verified: '#4ade80',
  comment: '#888888',
};

/**
 * Scrub bar in scene frames: filmstrip backdrop, playhead, in/out range, note markers.
 * `onSeek(frameIndex)` receives a 0-based index into the clip.
 */
export function Timeline({ frameStart, frameCount, frameIndex, onSeek, notes = [], inOut, filmstrip, aspect = 16 / 9, onNoteClick, selectedNoteId }) {
  const barRef = useRef(null);
  const [barW, setBarW] = useState(0);
  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setBarW(el.clientWidth));
    ro.observe(el);
    setBarW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const [hover, setHover] = useState(null); // { index, x }
  const dragging = useRef(false);
  const last = Math.max(1, frameCount - 1);

  const indexAt = (clientX) => {
    const b = barRef.current.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (clientX - b.left) / b.width));
    return Math.round(t * last);
  };
  const pct = (index) => `${(index / last) * 100}%`;

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    dragging.current = true;
    barRef.current.setPointerCapture(e.pointerId);
    onSeek(indexAt(e.clientX));
  };
  const onPointerMove = (e) => {
    const b = barRef.current.getBoundingClientRect();
    setHover({ index: indexAt(e.clientX), x: e.clientX - b.left });
    if (dragging.current) onSeek(indexAt(e.clientX));
  };
  const onPointerUp = () => {
    dragging.current = false;
  };

  const tile = (index) => {
    if (!filmstrip?.url || !filmstrip.tiles) return null;
    const t = Math.min(filmstrip.tiles - 1, Math.floor(index / (filmstrip.step || 1)));
    return { backgroundImage: `url("${filmstrip.url}")`, backgroundSize: `${filmstrip.tiles * 100}% 100%`, backgroundPosition: `${filmstrip.tiles > 1 ? (t / (filmstrip.tiles - 1)) * 100 : 0}% 0` };
  };

  const ticks = [];
  const every = frameCount > 400 ? 100 : frameCount > 120 ? 24 : frameCount > 48 ? 10 : 5;
  for (let f = Math.ceil(frameStart / every) * every; f < frameStart + frameCount; f += every) ticks.push(f);

  return (
    <div className="select-none">
      <div
        ref={barRef}
        role="slider"
        aria-label="Timeline"
        aria-valuemin={frameStart}
        aria-valuemax={frameStart + frameCount - 1}
        aria-valuenow={frameStart + frameIndex}
        tabIndex={-1}
        className="relative h-12 rounded-sm bg-[#111] border border-border cursor-pointer overflow-visible"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHover(null)}
      >
        {filmstrip?.url && barW > 0 && (
          // As many undistorted thumbnails as fit, each showing its part of the clip.
          <div className="absolute inset-0 flex overflow-hidden rounded-sm opacity-50 pointer-events-none" aria-hidden>
            {Array.from({ length: Math.max(1, Math.ceil(barW / (46 * aspect))) }, (_, i, arr) => (
              <div
                key={i}
                className="h-full shrink-0 border-r border-black/60"
                style={{ width: 46 * aspect, ...tile(Math.round(((i + 0.5) / arr.length) * last)) }}
              />
            ))}
          </div>
        )}
        {inOut && (
          <div
            className="absolute top-0 bottom-0 bg-primary/15 border-x-2 border-primary/70"
            style={{ left: pct(inOut.in), width: `calc(${pct(inOut.out - inOut.in)} + 2px)` }}
            aria-hidden
          />
        )}
        {notes.map((n) => {
          const s = (n.frame ?? frameStart) - frameStart;
          if (n.frame == null || s < 0 || s > last) return null;
          const e = Math.min(last, Math.max(s, (n.frame_end ?? n.frame) - frameStart));
          const color = NOTE_COLORS[n.status || 'comment'];
          return (
            <button
              key={n.id}
              type="button"
              title={`${n.frame}${n.frame_end && n.frame_end !== n.frame ? `–${n.frame_end}` : ''}: ${n.body || 'drawing'}`}
              onPointerDown={(ev) => ev.stopPropagation()}
              onClick={(ev) => {
                ev.stopPropagation();
                onNoteClick?.(n);
              }}
              className={`absolute -top-1.5 h-3 rounded-full ${n.id === selectedNoteId ? 'ring-2 ring-white' : ''}`}
              style={{ left: pct(s), width: e > s ? `calc(${pct(e - s)} + 6px)` : '6px', marginLeft: '-3px', background: color }}
            />
          );
        })}
        <div className="absolute top-0 bottom-0 w-0.5 bg-primary pointer-events-none" style={{ left: pct(frameIndex) }} aria-hidden>
          <div className="absolute -top-1 -left-[5px] w-3 h-2 bg-primary rounded-sm" />
        </div>
        {hover && (
          <div className="absolute bottom-full mb-2 -translate-x-1/2 pointer-events-none z-10" style={{ left: hover.x }}>
            {tile(hover.index) && <div className="w-40 aspect-video rounded-sm border border-border bg-black" style={tile(hover.index)} />}
            <div className="text-center text-[10px] font-mono text-foreground bg-black/80 rounded px-1 mt-0.5">{frameStart + hover.index}</div>
          </div>
        )}
      </div>
      <div className="relative h-4 mt-0.5 text-[10px] font-mono text-muted" aria-hidden>
        {ticks.map((f) => (
          <span key={f} className="absolute -translate-x-1/2" style={{ left: pct(f - frameStart) }}>
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}
