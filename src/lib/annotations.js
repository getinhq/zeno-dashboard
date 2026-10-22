/**
 * Review drawings: `{ shapes: [{ tool, color, width, points, text? }] }`.
 *
 * Points are normalized to the picture (0..1 on both axes, origin top-left) and stroke
 * width is a fraction of the picture height, so a drawing lines up at any player size
 * and on every revision regardless of its resolution.
 */

export const TOOLS = ['pen', 'arrow', 'rect', 'ellipse', 'text'];
export const COLORS = ['#ff3b30', '#ffcc00', '#34c759', '#0a84ff', '#ffffff', '#d4ff00'];
export const DEFAULT_WIDTH = 0.004;

/** Picture rectangle of a `contain`-fitted media element inside its box. */
export function containRect(boxW, boxH, mediaW, mediaH) {
  if (!boxW || !boxH || !mediaW || !mediaH) return { x: 0, y: 0, w: boxW || 0, h: boxH || 0 };
  const scale = Math.min(boxW / mediaW, boxH / mediaH);
  const w = mediaW * scale;
  const h = mediaH * scale;
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h };
}

export function toNormalized(clientX, clientY, el, rect) {
  const b = el.getBoundingClientRect();
  return [
    Math.min(1, Math.max(0, (clientX - b.left - rect.x) / rect.w)),
    Math.min(1, Math.max(0, (clientY - b.top - rect.y) / rect.h)),
  ];
}

/** Drop points closer than ~1px apart so pen strokes stay small. */
export function simplify(points, minDist = 0.002) {
  if (points.length < 3) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = out[out.length - 1];
    const [x, y] = points[i];
    if (Math.hypot(x - px, y - py) >= minDist) out.push(points[i]);
  }
  out.push(points[points.length - 1]);
  return out.map(([x, y]) => [Math.round(x * 10000) / 10000, Math.round(y * 10000) / 10000]);
}

function px(rect, [x, y]) {
  return [rect.x + x * rect.w, rect.y + y * rect.h];
}

export function drawShape(ctx, shape, rect) {
  const pts = (shape.points || []).map((p) => px(rect, p));
  if (!pts.length) return;
  const lw = Math.max(1.5, (shape.width || DEFAULT_WIDTH) * rect.h);
  ctx.save();
  ctx.strokeStyle = shape.color || COLORS[0];
  ctx.fillStyle = shape.color || COLORS[0];
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 2;

  const [a, b] = [pts[0], pts[pts.length - 1]];
  switch (shape.tool) {
    case 'arrow': {
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const head = Math.max(10, lw * 4);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0] - Math.cos(ang) * head * 0.6, b[1] - Math.sin(ang) * head * 0.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(b[0], b[1]);
      ctx.lineTo(b[0] - head * Math.cos(ang - 0.45), b[1] - head * Math.sin(ang - 0.45));
      ctx.lineTo(b[0] - head * Math.cos(ang + 0.45), b[1] - head * Math.sin(ang + 0.45));
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'rect':
      ctx.strokeRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      break;
    case 'ellipse':
      ctx.beginPath();
      ctx.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2, Math.abs(b[1] - a[1]) / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'text': {
      const size = Math.max(12, rect.h * 0.035);
      ctx.font = `600 ${size}px Inter, system-ui, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.shadowBlur = 4;
      ctx.fillText(shape.text || '', a[0], a[1]);
      break;
    }
    default: {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      if (pts.length === 1) {
        ctx.lineTo(pts[0][0] + 0.01, pts[0][1]);
      } else {
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i][0] + pts[i + 1][0]) / 2;
          const my = (pts[i][1] + pts[i + 1][1]) / 2;
          ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
        }
        ctx.lineTo(b[0], b[1]);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawShapes(ctx, shapes, rect) {
  (shapes || []).forEach((s) => drawShape(ctx, s, rect));
}

/** Notes whose drawing should be visible on `frame` (scene frame number). */
export function drawingsAtFrame(notes, frame) {
  return (notes || []).filter((n) => {
    if (!n.drawing?.shapes?.length || n.frame == null) return false;
    const end = n.frame_end ?? n.frame;
    return frame >= n.frame && frame <= end;
  });
}
