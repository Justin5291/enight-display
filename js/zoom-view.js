/* Pinch-to-zoom and pan for a media view (PDF pages or an image).
   Pinch with two fingers, drag with one, double-tap to zoom in or reset.
   Draw mode puts the #ink canvas on top with pointer-events, so while Draw
   is on these gestures never arrive here and strokes draw instead. */

const MAX_SCALE = 8;
const VIEW_KEY = "enight-zoom-v1";
const VIEW_MAX = 100;

function readViews() {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY) || "null");
    return v && typeof v === "object" ? v : {};
  } catch (e) { return {}; }
}

function loadView(key) {
  const row = readViews()[key];
  return row && Number.isFinite(Number(row.s)) ? row : null;
}

function saveView(key, view) {
  const all = readViews();
  all[key] = { s: view.s, cx: view.cx, cy: view.cy, t: Date.now() };
  const keys = Object.keys(all);
  if (keys.length > VIEW_MAX) {
    keys.sort((a, b) => (all[a].t || 0) - (all[b].t || 0));
    for (const k of keys.slice(0, keys.length - VIEW_MAX)) delete all[k];
  }
  try { localStorage.setItem(VIEW_KEY, JSON.stringify(all)); } catch (e) { /* full or private */ }
}

export function makeZoomable(view, content, opts) {
  const o = opts || {};
  let s = 1;
  let tx = 0;
  let ty = 0;
  const pts = new Map();
  let start = null;
  let lastTap = null;
  let moved = false;
  let settleTimer = null;

  view.classList.add("zoom-view");
  content.classList.add("zoom-content");

  function size() {
    return { vw: view.clientWidth, vh: view.clientHeight, cw: content.offsetWidth, ch: content.offsetHeight };
  }

  function clampAll() {
    const z = size();
    s = Math.max(1, Math.min(MAX_SCALE, s));
    const sw = z.cw * s;
    const sh = z.ch * s;
    tx = sw <= z.vw ? (z.vw - sw) / 2 : Math.min(0, Math.max(z.vw - sw, tx));
    ty = sh <= z.vh ? (z.vh - sh) / 2 : Math.min(0, Math.max(z.vh - sh, ty));
  }

  function apply(animate) {
    clampAll();
    content.style.transition = animate ? "transform 0.22s ease-out" : "none";
    content.style.transform = "translate3d(" + tx + "px," + ty + "px,0) scale(" + s + ")";
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      if (o.key && ready) saveView(o.key, describe());
      if (o.onSettle) o.onSettle(s);
    }, 260);
  }

  /* Saved as scale plus the content point at the view center (0..1 of the
     content box), so it restores even if the screen size changed. */
  function describe() {
    const z = size();
    return {
      s: Math.round(s * 1000) / 1000,
      cx: z.cw ? (z.vw / 2 - tx) / s / z.cw : 0.5,
      cy: z.ch ? (z.vh / 2 - ty) / s / z.ch : 0.5
    };
  }

  function restore(v) {
    const z = size();
    s = Math.max(1, Math.min(MAX_SCALE, Number(v.s) || 1));
    tx = z.vw / 2 - (Number(v.cx) || 0) * z.cw * s;
    ty = z.vh / 2 - (Number(v.cy) || 0) * z.ch * s;
    apply(false);
  }

  function local(e) {
    const r = view.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function zoomAt(next, px, py, animate) {
    const cx = (px - tx) / s;
    const cy = (py - ty) / s;
    s = Math.max(1, Math.min(MAX_SCALE, next));
    tx = px - cx * s;
    ty = py - cy * s;
    apply(animate);
  }

  function snapshot() {
    const list = [...pts.values()];
    if (list.length >= 2) {
      const a = list[0];
      const b = list[1];
      start = {
        mode: "pinch",
        dist: Math.hypot(b.x - a.x, b.y - a.y) || 1,
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2,
        s: s,
        tx: tx,
        ty: ty
      };
    } else if (list.length === 1) {
      start = { mode: "pan", x: list[0].x, y: list[0].y, tx: tx, ty: ty };
    } else {
      start = null;
    }
  }

  view.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    try { view.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
    pts.set(e.pointerId, local(e));
    if (pts.size === 1) moved = false;
    else moved = true;
    snapshot();
    e.preventDefault();
  });

  view.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId) || !start) return;
    pts.set(e.pointerId, local(e));
    const list = [...pts.values()];
    if (start.mode === "pinch" && list.length >= 2) {
      const a = list[0];
      const b = list[1];
      const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const next = Math.max(1, Math.min(MAX_SCALE, start.s * dist / start.dist));
      const cx = (start.mx - start.tx) / start.s;
      const cy = (start.my - start.ty) / start.s;
      s = next;
      tx = mx - cx * s;
      ty = my - cy * s;
      apply(false);
    } else if (start.mode === "pan" && list.length === 1) {
      const dx = list[0].x - start.x;
      const dy = list[0].y - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 8) moved = true;
      tx = start.tx + dx;
      ty = start.ty + dy;
      apply(false);
    }
    e.preventDefault();
  });

  function up(e) {
    if (!pts.has(e.pointerId)) return;
    const p = pts.get(e.pointerId);
    pts.delete(e.pointerId);
    if (!pts.size && !moved && e.type === "pointerup") {
      const now = Date.now();
      if (lastTap && now - lastTap.t < 320 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 40) {
        lastTap = null;
        if (s > 1.05) reset(true);
        else zoomAt(2.5, p.x, p.y, true);
      } else {
        lastTap = { t: now, x: p.x, y: p.y };
      }
    }
    snapshot();
  }
  view.addEventListener("pointerup", up);
  view.addEventListener("pointercancel", up);

  view.addEventListener("wheel", (e) => {
    e.preventDefault();
    const p = local(e);
    if (e.ctrlKey) zoomAt(s * Math.exp(-e.deltaY / 100), p.x, p.y, false);
    else { tx -= e.deltaX; ty -= e.deltaY; apply(false); }
  }, { passive: false });

  /* Safari's own page zoom gestures. */
  for (const name of ["gesturestart", "gesturechange", "gestureend"]) {
    view.addEventListener(name, (e) => e.preventDefault());
  }

  function reset(animate) {
    s = 1;
    tx = 0;
    ty = 0;
    apply(animate);
  }

  function relayout() {
    apply(false);
  }

  let ready = false;
  const saved = o.key ? loadView(o.key) : null;
  if (saved) restore(saved);
  else reset(false);
  ready = true;
  return { reset: reset, relayout: relayout, scale: () => s };
}
