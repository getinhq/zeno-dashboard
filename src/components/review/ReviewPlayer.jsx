import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  ChevronFirst,
  ChevronLast,
  Circle,
  Info,
  Maximize,
  Pause,
  PenLine,
  Play,
  Repeat,
  Square,
  StepBack,
  StepForward,
  Type,
  Undo2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { createFrameController, frameToTime, frameToTimecode } from '../../lib/frameController';
import { COLORS, drawingsAtFrame } from '../../lib/annotations';
import { mediaUrl } from '../../api/client';
import { Viewer } from './Viewer';
import { Timeline } from './Timeline';
import { Composer, NotesPanel } from './NotesPanel';

const RATES = [0.25, 0.5, 1, 1.5, 2];
const TOOLS = [
  { id: 'pen', icon: PenLine, label: 'Pen (D)' },
  { id: 'arrow', icon: ArrowUpRight, label: 'Arrow' },
  { id: 'rect', icon: Square, label: 'Box' },
  { id: 'ellipse', icon: Circle, label: 'Ellipse' },
  { id: 'text', icon: Type, label: 'Text' },
];

export function fpsLabel(fps) {
  if (!fps) return '';
  const r = Math.round(fps * 1000) / 1000;
  return Number.isInteger(r) ? String(r) : r.toFixed(3);
}

function typing() {
  const el = document.activeElement;
  const tag = el?.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el?.isContentEditable;
}

/** Owns a frame controller for whichever <video> is currently mounted for one side. */
function useController(item, onFrame, startIndexRef) {
  const [el, setEl] = useState(null);
  const ctlRef = useRef(null);
  const [ready, setReady] = useState(false);
  const fps = item?.fps;
  const count = item?.frame_count;

  useEffect(() => {
    setReady(false);
    if (!el || el.tagName !== 'VIDEO' || !fps || !count) return undefined;
    let ctl = null;
    const init = () => {
      if (ctl) return;
      ctl = createFrameController(el, { fps, frameCount: count, onFrame });
      ctlRef.current = ctl;
      setReady(true);
      const start = startIndexRef?.current ?? 0;
      ctl.seek(start);
    };
    if (el.readyState >= 2) init();
    else el.addEventListener('loadeddata', init, { once: true });
    return () => {
      el.removeEventListener('loadeddata', init);
      ctl?.destroy();
      if (ctlRef.current === ctl) ctlRef.current = null;
    };
  }, [el, fps, count, onFrame, startIndexRef]);

  return { el, setEl, ctlRef, ready };
}

/**
 * Frame-accurate review player with compare, drawings and notes.
 *
 * - `item`: the revision under review (API review item).
 * - `compareOptions`: other revisions that can be shown as B; `defaultCompareId` preselects one.
 * - `notes`: the task's note threads. `caps` decides which actions are offered.
 */
export function ReviewPlayer({
  item,
  compareOptions = [],
  defaultCompareId = null,
  notes,
  caps,
  guest,
  onAddNote,
  onStatus,
  onReply,
  onDeleteNote,
}) {
  const isVideo = item.kind === 'video' && item.frame_count > 0;
  const frameCount = isVideo ? item.frame_count : 1;
  const [frameIdx, setFrameIdx] = useState(0);
  const frameRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [inOut, setInOut] = useState(null); // indices
  const [loopOn, setLoopOn] = useState(true);
  const [muted, setMuted] = useState(false);
  const [mode, setMode] = useState('off');
  const [compareId, setCompareId] = useState(defaultCompareId);
  const [showB, setShowB] = useState(false);
  const [tool, setTool] = useState(null);
  const [color, setColor] = useState(COLORS[0]);
  const [draft, setDraft] = useState([]);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [hudOn, setHudOn] = useState(true);
  const [dropped, setDropped] = useState(0);
  const shellRef = useRef(null);
  const composerRef = useRef(null);

  const onFrameA = useCallback((i) => {
    frameRef.current = i;
    setFrameIdx(i);
  }, []);
  const A = useController(isVideo ? item : null, onFrameA, frameRef);
  const compareItem = compareOptions.find((c) => c.id === compareId) || null;
  const bStartRef = useRef(0);
  const B = useController(mode !== 'off' && compareItem?.kind === 'video' ? compareItem : null, null, bStartRef);

  const scene = item.frame_start + frameIdx;
  const ctl = () => A.ctlRef.current;

  useEffect(() => {
    setFrameIdx(0);
    frameRef.current = 0;
    setInOut(null);
    setDraft([]);
    setTool(null);
  }, [item.id]);

  useEffect(() => {
    if (!compareId && defaultCompareId) setCompareId(defaultCompareId);
  }, [defaultCompareId, compareId]);

  // Play state + dropped-frame readout from side A.
  useEffect(() => {
    const el = A.el;
    if (!el || el.tagName !== 'VIDEO') return undefined;
    const sync = () => setPlaying(!el.paused);
    el.addEventListener('play', sync);
    el.addEventListener('pause', sync);
    const t = setInterval(() => {
      const q = el.getVideoPlaybackQuality?.();
      if (q) setDropped(q.droppedVideoFrames);
    }, 1000);
    return () => {
      el.removeEventListener('play', sync);
      el.removeEventListener('pause', sync);
      clearInterval(t);
    };
  }, [A.el]);

  useEffect(() => {
    ctl()?.setLoop(inOut && loopOn ? inOut : null);
  }, [inOut, loopOn, A.ready]);

  useEffect(() => {
    if (A.el && A.el.tagName === 'VIDEO') A.el.playbackRate = rate;
    if (B.el && B.el.tagName === 'VIDEO') B.el.playbackRate = rate;
  }, [rate, A.el, B.el]);

  // Keep B on the same scene frame as A.
  const bTarget = compareItem ? scene - compareItem.frame_start : 0;
  const bInRange = compareItem ? bTarget >= 0 && bTarget < (compareItem.frame_count || 1) : false;
  bStartRef.current = Math.max(0, bTarget);
  useEffect(() => {
    const bCtl = B.ctlRef.current;
    const el = B.el;
    if (!bCtl || !el || mode === 'off') return;
    if (!bInRange) {
      if (!el.paused) el.pause();
      return;
    }
    if (playing) {
      if (el.paused) {
        el.currentTime = frameToTime(bTarget, compareItem.fps);
        el.play().catch(() => {});
      } else if (Math.abs(bCtl.frame - bTarget) > 1) {
        el.currentTime = frameToTime(bTarget, compareItem.fps);
      }
    } else {
      bCtl.seek(bTarget);
    }
  }, [bTarget, bInRange, playing, mode, B.ready, B.el, compareItem]);

  const seekIdx = (i) => ctl()?.seek(i);
  const seekScene = (f) => seekIdx(f - item.frame_start);
  const togglePlay = () => {
    if (!ctl()) return;
    setTool(null);
    ctl().toggle();
  };
  const startTool = (t) => {
    ctl()?.pause();
    setTool((cur) => (cur === t ? null : t));
  };

  const markIn = () => setInOut((r) => ({ in: frameIdx, out: r && r.out > frameIdx ? r.out : frameCount - 1 }));
  const markOut = () => setInOut((r) => ({ in: r && r.in < frameIdx ? r.in : 0, out: frameIdx }));

  const drawable = (notes || []).filter((n) => n.kind !== 'decision');
  const unresolved = useMemo(
    () => drawable.filter((n) => n.frame != null && (n.status === 'open' || n.status === 'fixed')).sort((a, b) => a.frame - b.frame),
    [notes]
  );
  const jumpNote = (dir) => {
    const list = unresolved.filter((n) => n.frame >= item.frame_start && n.frame < item.frame_start + frameCount);
    if (!list.length) return;
    const next = dir > 0 ? list.find((n) => n.frame > scene) || list[0] : [...list].reverse().find((n) => n.frame < scene) || list[list.length - 1];
    selectNote(next);
  };
  const selectNote = (n) => {
    setSelectedNoteId(n.id);
    if (n.frame != null && n.frame >= item.frame_start && n.frame < item.frame_start + frameCount) seekScene(n.frame);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (typing() || e.altKey) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key;
      if (mod && k.toLowerCase() === 'z') {
        e.preventDefault();
        setDraft((d) => d.slice(0, -1));
        return;
      }
      if (mod) return;
      const handled = {
        ' ': togglePlay,
        k: () => ctl()?.pause(),
        l: () => {
          setRate((r) => (playing && r < 2 ? r * 2 : 1));
          ctl()?.play();
        },
        j: () => ctl()?.playReverse(1),
        ArrowRight: () => ctl()?.step(e.shiftKey ? 10 : 1),
        ArrowLeft: () => ctl()?.step(e.shiftKey ? -10 : -1),
        Home: () => seekIdx(inOut ? inOut.in : 0),
        End: () => seekIdx(inOut ? inOut.out : frameCount - 1),
        i: markIn,
        o: markOut,
        p: () => setLoopOn((v) => !v),
        ']': () => jumpNote(1),
        '[': () => jumpNote(-1),
        d: () => startTool('pen'),
        Escape: () => setTool(null),
        n: () => {
          ctl()?.pause();
          setTimeout(() => composerRef.current?.focus(), 0);
        },
        m: () => setMuted((v) => !v),
        h: () => setHudOn((v) => !v),
        c: () => compareOptions.length && setMode((m) => ({ off: 'wipe', wipe: 'side', side: 'flip', flip: 'off' })[m]),
        b: () => setShowB((v) => !v),
        f: () => (document.fullscreenElement ? document.exitFullscreen() : shellRef.current?.requestFullscreen?.()),
      }[k.length === 1 ? k.toLowerCase() : k];
      if (handled) {
        e.preventDefault();
        handled();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const overlayShapes = useMemo(() => {
    const shown = tool || !playing ? drawingsAtFrame(drawable, scene) : [];
    const sel = drawable.find((n) => n.id === selectedNoteId);
    const extra = sel && !shown.includes(sel) && sel.frame === scene && sel.drawing?.shapes ? [sel] : [];
    return [...shown, ...extra].flatMap((n) => n.drawing.shapes).concat(draft);
  }, [notes, scene, draft, tool, playing, selectedNoteId]);

  const submitNote = async (payload) => {
    await onAddNote({ ...payload, drawing: draft.length ? { shapes: draft } : null });
    setDraft([]);
    setTool(null);
  };

  const urlA = mediaUrl(item.media?.proxy);
  const urlB = compareItem ? mediaUrl(compareItem.media?.proxy) : null;
  const filmstrip = item.media?.filmstrip
    ? { url: mediaUrl(item.media.filmstrip), tiles: item.filmstrip_tiles, step: item.filmstrip_step }
    : null;

  const hud = hudOn ? (
    // One wrapping row so the two labels never overlap in narrow (side-by-side) panes.
    <div className="absolute top-2 left-2 right-2 flex flex-wrap justify-between gap-1 text-[11px] font-mono pointer-events-none">
      <span className="bg-black/70 text-foreground px-2 py-1 rounded">
        {item.task?.entity_label || item.task?.title} · {item.label} · <span className="text-primary">{scene}</span>
        {isVideo && <span className="text-muted"> / {item.frame_start}–{item.frame_end}</span>}
      </span>
      <span className="bg-black/70 text-muted px-2 py-1 rounded">
        {isVideo ? `Proxy H.264 · ${fpsLabel(item.fps)} fps` : 'Still'} · Rec.709/sRGB
        {item.width ? ` · src ${item.width}×${item.height}` : ''}
        {playing && dropped > 0 && <span className="text-warning"> · {dropped} dropped</span>}
      </span>
    </div>
  ) : null;

  const bMessage =
    compareItem && !bInRange
      ? `${compareItem.label} has no frame ${scene} (it covers ${compareItem.frame_start}–${compareItem.frame_end ?? compareItem.frame_start})`
      : null;

  return (
    <div ref={shellRef} className="flex flex-col lg:flex-row gap-4 h-full min-h-0 bg-background">
      <div className="flex flex-col gap-2 flex-1 min-w-0 min-h-0">
        <div className="relative flex-1 min-h-[240px] rounded-md overflow-hidden border border-border">
          {urlA ? (
            <Viewer
              a={{ item, url: urlA }}
              b={compareItem && mode !== 'off' ? { item: compareItem, url: urlB } : null}
              mode={mode}
              showB={showB}
              setMediaA={A.setEl}
              setMediaB={B.setEl}
              muted={muted}
              shapes={overlayShapes}
              tool={tool}
              color={color}
              onShape={(s) => setDraft((d) => [...d, s])}
              bMessage={bMessage}
              hud={hud}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted text-sm">Preparing media…</div>
          )}
        </div>

        {isVideo && (
          <Timeline
            frameStart={item.frame_start}
            frameCount={frameCount}
            frameIndex={frameIdx}
            onSeek={seekIdx}
            notes={drawable}
            inOut={inOut}
            filmstrip={filmstrip}
            aspect={item.width && item.height ? item.width / item.height : 16 / 9}
            onNoteClick={selectNote}
            selectedNoteId={selectedNoteId}
          />
        )}

        <div className="flex items-center gap-1.5 flex-wrap text-sm">
          {isVideo && (
            <>
              <IconBtn label="First frame (Home)" onClick={() => seekIdx(inOut ? inOut.in : 0)}><ChevronFirst /></IconBtn>
              <IconBtn label="Previous frame (←)" onClick={() => ctl()?.step(-1)}><StepBack /></IconBtn>
              <IconBtn label={playing ? 'Pause (Space)' : 'Play (Space)'} onClick={togglePlay} primary>
                {playing ? <Pause /> : <Play />}
              </IconBtn>
              <IconBtn label="Next frame (→)" onClick={() => ctl()?.step(1)}><StepForward /></IconBtn>
              <IconBtn label="Last frame (End)" onClick={() => seekIdx(inOut ? inOut.out : frameCount - 1)}><ChevronLast /></IconBtn>
              <FrameInput value={scene} min={item.frame_start} max={item.frame_start + frameCount - 1} onCommit={seekScene} />
              <span className="font-mono text-xs text-muted hidden md:inline">{frameToTimecode(frameIdx, item.fps)}</span>
              <span className="mx-1 w-px h-5 bg-border" />
              <button type="button" className="btn-secondary text-xs py-1 px-2" onClick={markIn} title="Set in point (I)">In</button>
              <button type="button" className="btn-secondary text-xs py-1 px-2" onClick={markOut} title="Set out point (O)">Out</button>
              {inOut && (
                <>
                  <IconBtn label="Loop in/out (P)" onClick={() => setLoopOn((v) => !v)} active={loopOn}><Repeat /></IconBtn>
                  <button type="button" className="text-xs text-muted hover:text-foreground" onClick={() => setInOut(null)}>clear</button>
                </>
              )}
              <select
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="bg-[#111] border border-border rounded text-xs px-1 py-1"
                aria-label="Playback speed"
              >
                {RATES.map((r) => (
                  <option key={r} value={r}>{r}×</option>
                ))}
              </select>
              {item.has_audio && (
                <IconBtn label="Mute (M)" onClick={() => setMuted((v) => !v)}>{muted ? <VolumeX /> : <Volume2 />}</IconBtn>
              )}
            </>
          )}
          <span className="mx-1 w-px h-5 bg-border" />
          {caps.canNote &&
            TOOLS.map(({ id, icon: Icon, label }) => (
              <IconBtn key={id} label={label} onClick={() => startTool(id)} active={tool === id}><Icon /></IconBtn>
            ))}
          {caps.canNote && (tool || draft.length > 0) && (
            <>
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Colour ${c}`}
                  onClick={() => setColor(c)}
                  className={`w-4 h-4 rounded-full border ${color === c ? 'border-white scale-125' : 'border-border'}`}
                  style={{ background: c }}
                />
              ))}
              <IconBtn label="Undo mark (⌘Z)" onClick={() => setDraft((d) => d.slice(0, -1))}><Undo2 /></IconBtn>
            </>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {compareOptions.length > 0 && (
              <>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="bg-[#111] border border-border rounded text-xs px-1 py-1"
                  aria-label="Compare mode"
                  title="Compare (C)"
                >
                  <option value="off">Compare: off</option>
                  <option value="wipe">Wipe</option>
                  <option value="side">Side by side</option>
                  <option value="flip">Flip A/B (B)</option>
                </select>
                {mode !== 'off' && (
                  <select
                    value={compareId || ''}
                    onChange={(e) => setCompareId(e.target.value)}
                    className="bg-[#111] border border-border rounded text-xs px-1 py-1"
                    aria-label="Compare against"
                  >
                    {compareOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        B: {c.label}
                        {c.review_status === 'approved' ? ' (approved)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
            <IconBtn label="Info overlay (H)" onClick={() => setHudOn((v) => !v)} active={hudOn}><Info /></IconBtn>
            <IconBtn label="Full screen (F)" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : shellRef.current?.requestFullscreen?.())}>
              <Maximize />
            </IconBtn>
          </div>
        </div>
      </div>

      <aside className="w-full lg:w-96 shrink-0 min-h-0 flex flex-col">
        <NotesPanel
          notes={notes}
          item={item}
          selectedNoteId={selectedNoteId}
          caps={caps}
          onSelect={selectNote}
          onStatus={onStatus}
          onReply={onReply}
          onDelete={onDeleteNote}
          composer={
            caps.canNote ? (
              <Composer
                ref={composerRef}
                frame={scene}
                inOut={inOut ? { ...inOut, inFrame: item.frame_start + inOut.in, outFrame: item.frame_start + inOut.out } : null}
                shapesCount={draft.length}
                onClearDrawing={() => setDraft([])}
                onSubmit={submitNote}
                guest={guest}
              />
            ) : null
          }
        />
      </aside>
    </div>
  );
}

function IconBtn({ children, label, onClick, active, primary }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`p-1.5 rounded-sm border transition-colors [&>svg]:w-4 [&>svg]:h-4 ${
        primary
          ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
          : active
            ? 'border-primary/70 text-primary bg-primary/10'
            : 'border-border text-foreground hover:bg-card-hover'
      }`}
    >
      {children}
    </button>
  );
}

function FrameInput({ value, min, max, onCommit }) {
  const [text, setText] = useState(String(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setText(String(value));
  }, [value, editing]);
  const commit = () => {
    setEditing(false);
    const n = parseInt(text, 10);
    if (Number.isFinite(n)) onCommit(Math.min(max, Math.max(min, n)));
  };
  return (
    <input
      aria-label="Frame"
      value={editing ? text : String(value)}
      onFocus={(e) => {
        setEditing(true);
        e.target.select();
      }}
      onChange={(e) => setText(e.target.value.replace(/[^0-9-]/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.target.blur();
        if (e.key === 'Escape') {
          setEditing(false);
          e.target.blur();
        }
      }}
      className="w-16 text-center font-mono text-sm bg-[#111] border border-border focus:border-primary rounded px-1 py-1 outline-none text-primary"
    />
  );
}
