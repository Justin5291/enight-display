let canvas = null;
let bar = null;
let toggleBtn = null;
let getMarkup = () => ({ color: "#ffe14a", size: 18, tool: "pen" });
let on = false;
let listener = () => {};
let strokes = [];
let active = null;
let pointerId = null;

export function initMarkup(opts) {
  canvas = opts.canvas;
  bar = opts.bar || null;
  toggleBtn = opts.toggleBtn || null;
  getMarkup = opts.getMarkup;
  if (opts.undoBtn) opts.undoBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    undo();
  });
  if (opts.clearBtn) opts.clearBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    clearInk();
  });
  if (toggleBtn) toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setOn(!on);
  });
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  window.addEventListener("resize", resize);
  resize();
}

export function markupOn() {
  return on;
}

export function setMarkupListener(fn) {
  listener = fn || (() => {});
}

export function setOn(value) {
  on = !!value;
  if (canvas) canvas.classList.toggle("on", on);
  if (bar) bar.hidden = !on;
  if (toggleBtn) {
    toggleBtn.setAttribute("aria-pressed", on ? "true" : "false");
    toggleBtn.classList.toggle("on", on);
    toggleBtn.textContent = on ? "Draw on" : "Draw";
  }
  if (!on) {
    pointerId = null;
    active = null;
    redraw();
  }
  listener(on);
}

export function clearInk() {
  strokes = [];
  active = null;
  redraw();
}

export function undo() {
  if (active) {
    active = null;
    pointerId = null;
    redraw();
    return;
  }
  strokes.pop();
  redraw();
}

export function resize() {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round((rect.width || 1) * dpr));
  canvas.height = Math.max(1, Math.round((rect.height || 1) * dpr));
  canvas._cssW = rect.width || 1;
  redraw();
}

function onDown(e) {
  if (!on || pointerId != null) return;
  pointerId = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
  e.preventDefault();
  const style = getMarkup();
  active = {
    tool: style.tool || "pen",
    color: style.color || "#ffe14a",
    size: Number(style.size) || 18,
    points: [point(e)]
  };
  const extra = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
  if (extra && extra.length) active.points = extra.map(point);
  redraw();
}

function onMove(e) {
  if (!active || e.pointerId !== pointerId) return;
  const batch = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  if (active.tool === "pen" || active.tool === "highlighter") {
    for (const ev of batch) active.points.push(point(ev));
  } else {
    const last = batch[batch.length - 1] || e;
    active.points = [active.points[0], point(last)];
  }
  redraw();
}

function onUp(e) {
  if (e.pointerId !== pointerId) return;
  pointerId = null;
  if (active && active.points.length) strokes.push(active);
  active = null;
  redraw();
}

function point(e) {
  const rect = canvas.getBoundingClientRect();
  const x = rect.width ? (e.clientX - rect.left) / rect.width : 0;
  const y = rect.height ? (e.clientY - rect.top) / rect.height : 0;
  return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
}

function redraw() {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  for (const stroke of strokes) drawStroke(ctx, stroke, w, h);
  if (active) drawStroke(ctx, active, w, h);
}

function drawStroke(ctx, stroke, w, h) {
  const pts = stroke.points;
  if (!pts.length) return;
  const scale = w / (canvas._cssW || w);
  const width = Math.max(1, stroke.size * scale);
  const hi = stroke.tool === "highlighter";
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.globalAlpha = hi ? 0.35 : 1;
  ctx.lineWidth = hi ? width * 2.4 : width;
  const xy = pts.map((p) => [p.x * w, p.y * h]);
  if (stroke.tool === "pen" || stroke.tool === "highlighter") {
    if (xy.length === 1) {
      ctx.beginPath();
      ctx.arc(xy[0][0], xy[0][1], ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(xy[0][0], xy[0][1]);
      for (let i = 1; i < xy.length - 1; i++) {
        const mx = (xy[i][0] + xy[i + 1][0]) / 2;
        const my = (xy[i][1] + xy[i + 1][1]) / 2;
        ctx.quadraticCurveTo(xy[i][0], xy[i][1], mx, my);
      }
      const last = xy[xy.length - 1];
      ctx.lineTo(last[0], last[1]);
      ctx.stroke();
    }
  } else if (xy.length >= 2) {
    const a = xy[0];
    const b = xy[xy.length - 1];
    if (stroke.tool === "line" || stroke.tool === "arrow") {
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
      if (stroke.tool === "arrow") {
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        const len = 18 * scale + width;
        ctx.beginPath();
        ctx.moveTo(b[0], b[1]);
        ctx.lineTo(b[0] - len * Math.cos(ang - 0.45), b[1] - len * Math.sin(ang - 0.45));
        ctx.moveTo(b[0], b[1]);
        ctx.lineTo(b[0] - len * Math.cos(ang + 0.45), b[1] - len * Math.sin(ang + 0.45));
        ctx.stroke();
      }
    } else if (stroke.tool === "rect") {
      ctx.strokeRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    } else if (stroke.tool === "ellipse") {
      ctx.beginPath();
      ctx.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.max(1, Math.abs(b[0] - a[0]) / 2), Math.max(1, Math.abs(b[1] - a[1]) / 2), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}
