import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { containRect, drawShape, drawShapes, simplify, toNormalized, DEFAULT_WIDTH } from '../../lib/annotations';

function useBoxSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** Media element for one side (video proxy or still image). */
function Media({ item, url, mediaRef, muted, style, className = '' }) {
  if (!url) {
    return <div className="absolute inset-0 flex items-center justify-center text-muted text-sm">No playable media</div>;
  }
  if (item.kind === 'image') {
    return <img ref={mediaRef} src={url} alt={item.label} className={`absolute inset-0 w-full h-full object-contain ${className}`} style={style} draggable={false} />;
  }
  return (
    <video
      ref={mediaRef}
      src={url}
      className={`absolute inset-0 w-full h-full object-contain ${className}`}
      style={style}
      muted={muted}
      playsInline
      preload="auto"
    />
  );
}

/** Canvas over the picture: renders note drawings and captures new ones. */
function DrawingLayer({ box, media, shapes, tool, color, onShape }) {
  const canvasRef = useRef(null);
  const draft = useRef(null);
  const [textAt, setTextAt] = useState(null); // { point, left, top }
  const [text, setText] = useState('');
  const rect = containRect(box.w, box.h, media.w, media.h);

  const paint = () => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(box.w * dpr) || c.height !== Math.round(box.h * dpr)) {
      c.width = Math.round(box.w * dpr);
      c.height = Math.round(box.h * dpr);
    }
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, box.w, box.h);
    drawShapes(ctx, shapes, rect);
    if (draft.current) drawShape(ctx, draft.current, rect);
  };
  useEffect(paint);

  const down = (e) => {
    if (!tool || e.button !== 0) return;
    e.preventDefault();
    const p = toNormalized(e.clientX, e.clientY, canvasRef.current, rect);
    if (tool === 'text') {
      setTextAt({ point: p, left: rect.x + p[0] * rect.w, top: rect.y + p[1] * rect.h });
      setText('');
      return;
    }
    canvasRef.current.setPointerCapture(e.pointerId);
    draft.current = { tool, color, width: DEFAULT_WIDTH, points: [p, p] };
    paint();
  };
  const move = (e) => {
    if (!draft.current) return;
    const p = toNormalized(e.clientX, e.clientY, canvasRef.current, rect);
    if (draft.current.tool === 'pen') draft.current.points.push(p);
    else draft.current.points[1] = p;
    paint();
  };
  const up = () => {
    const d = draft.current;
    draft.current = null;
    if (!d) return;
    const [a, b] = [d.points[0], d.points[d.points.length - 1]];
    const tiny = Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.005;
    if (d.tool !== 'pen' && tiny) {
      paint();
      return;
    }
    onShape({ ...d, points: d.tool === 'pen' ? simplify(d.points) : [a, b] });
  };
  const commitText = () => {
    if (text.trim()) onShape({ tool: 'text', color, width: DEFAULT_WIDTH, points: [textAt.point], text: text.trim().slice(0, 200) });
    setTextAt(null);
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full ${tool ? 'cursor-crosshair' : 'pointer-events-none'}`}
        style={{ touchAction: 'none' }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
      {textAt && (
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitText();
            if (e.key === 'Escape') setTextAt(null);
            e.stopPropagation();
          }}
          onBlur={commitText}
          placeholder="Type, then Enter"
          className="absolute bg-black/70 border border-primary text-sm px-1 py-0.5 rounded outline-none"
          style={{ left: textAt.left, top: textAt.top, color }}
        />
      )}
    </>
  );
}

function Tag({ children, side = 'left' }) {
  return (
    <span className={`absolute bottom-2 ${side === 'left' ? 'left-2' : 'right-2'} text-[11px] font-mono bg-black/70 text-foreground px-1.5 py-0.5 rounded pointer-events-none`}>
      {children}
    </span>
  );
}

/**
 * Picture area. `mode`: 'off' | 'wipe' | 'side' | 'flip'. Drawings live on side A.
 */
export function Viewer({
  a,
  b,
  mode = 'off',
  showB = false,
  setMediaA,
  setMediaB,
  muted,
  shapes,
  tool,
  color,
  onShape,
  bMessage,
  hud,
}) {
  const boxRef = useRef(null);
  const box = useBoxSize(boxRef);
  const [wipe, setWipe] = useState(50);
  const wipeDrag = useRef(false);
  const mediaSize = (it) => ({ w: it?.width || 16, h: it?.height || 9 });
  const compare = b && mode !== 'off';
  const half = { w: box.w / 2, h: box.h };

  const bOverlay = bMessage ? (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-sm text-muted text-center px-4">{bMessage}</div>
  ) : null;

  if (compare && mode === 'side') {
    return (
      <div ref={boxRef} className="relative w-full h-full grid grid-cols-2 gap-px bg-border">
        <div className="relative bg-black overflow-hidden">
          <Media item={a.item} url={a.url} mediaRef={setMediaA} muted={muted} />
          <DrawingLayer box={half} media={mediaSize(a.item)} shapes={shapes} tool={tool} color={color} onShape={onShape} />
          <Tag>A · {a.item.label}</Tag>
          {hud}
        </div>
        <div className="relative bg-black overflow-hidden">
          <Media item={b.item} url={b.url} mediaRef={setMediaB} muted />
          <Tag side="right">B · {b.item.label}</Tag>
          {bOverlay}
        </div>
      </div>
    );
  }

  const bVisible = compare && (mode === 'wipe' || (mode === 'flip' && showB));
  const clip = mode === 'wipe' ? `inset(0 0 0 ${wipe}%)` : undefined;

  return (
    <div
      ref={boxRef}
      className="relative w-full h-full bg-black overflow-hidden"
      onPointerMove={(e) => {
        if (!wipeDrag.current) return;
        const r = boxRef.current.getBoundingClientRect();
        setWipe(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
      }}
      onPointerUp={() => {
        wipeDrag.current = false;
      }}
    >
      <Media item={a.item} url={a.url} mediaRef={setMediaA} muted={muted} style={{ visibility: mode === 'flip' && bVisible ? 'hidden' : 'visible' }} />
      {compare && (
        <div className="absolute inset-0" style={{ clipPath: clip, visibility: bVisible ? 'visible' : 'hidden' }}>
          <Media item={b.item} url={b.url} mediaRef={setMediaB} muted />
          {bOverlay}
        </div>
      )}
      {!(mode === 'flip' && bVisible) && (
        <DrawingLayer box={box} media={mediaSize(a.item)} shapes={shapes} tool={tool} color={color} onShape={onShape} />
      )}
      {compare && mode === 'wipe' && (
        <div
          className="absolute top-0 bottom-0 w-4 -ml-2 cursor-ew-resize flex justify-center z-10"
          style={{ left: `${wipe}%` }}
          onPointerDown={(e) => {
            e.preventDefault();
            wipeDrag.current = true;
            e.currentTarget.parentElement.setPointerCapture(e.pointerId);
          }}
          role="separator"
          aria-label="Wipe position"
        >
          <div className="w-0.5 h-full bg-primary" />
        </div>
      )}
      {compare && mode === 'wipe' && (
        <>
          <Tag>A · {a.item.label}</Tag>
          <Tag side="right">B · {b.item.label}</Tag>
        </>
      )}
      {compare && mode === 'flip' && <Tag>{showB ? `B · ${b.item.label}` : `A · ${a.item.label}`}</Tag>}
      {hud}
    </div>
  );
}
