import { el, clear, topbar, starsLabel, clamp } from "./util.js";
import { getState, update } from "./state.js";
import { flash } from "./operator.js";

export function mountSites(node, state) {
  paintDash(node, state);
  node._patch = (s) => {
    const sig = s.sites.map((site) => [site.id, site.name, site.mode, site.group, site.url].join(":")).join("|") + "|" + s.brand.title;
    if (sig === node._sig && node.firstChild) return;
    node._sig = sig;
    paintDash(node, s);
  };
}

function paintDash(node, state) {
  clear(node);
  node._sig = state.sites.map((site) => [site.id, site.name, site.mode, site.group, site.url].join(":")).join("|") + "|" + state.brand.title;
  node.appendChild(topbar(state.brand, "LIVE BOARDS"));
  const scroll = el("div", { class: "dash-scroll" });
  if (!state.sites.length) {
    scroll.appendChild(el("div", { class: "kx-empty" }, [
      starsLabel("SITES"),
      el("h1", { class: "h-display silver", text: "NO SITES" })
    ]));
  }
  let group = null;
  let grid = null;
  for (const site of state.sites) {
    if (site.group !== group) {
      group = site.group;
      scroll.appendChild(el("div", { class: "group-name", text: group }));
      grid = el("div", { class: "tile-grid" });
      scroll.appendChild(grid);
    }
    grid.appendChild(siteTile(site));
  }
  const dash = el("div", { class: "dash" }, [scroll]);
  node.appendChild(dash);
}

function siteTile(site) {
  const btn = el("button", { type: "button", class: "tile-btn" });
  const mark = el("div", { class: "tile-mark", text: letter(site.name) });
  mark.style.background = tint(site.name);
  btn.appendChild(mark);
  btn.appendChild(el("div", { class: "tile-name", text: site.name }));
  btn.appendChild(el("div", { class: "tile-mode", text: site.mode === "embed" ? "EMBED" : "SAFARI" }));
  btn.addEventListener("click", () => openSite(site.id));
  return btn;
}

function letter(name) {
  const ch = String(name || "?").trim().charAt(0);
  return ch.toUpperCase() || "?";
}

function tint(name) {
  const colors = ["#8d1218", "#1d4e9f", "#0e4d6e", "#6e4a12", "#243864"];
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return colors[h % colors.length];
}

export function openSite(id) {
  const site = getState().sites.find((s) => s.id === id);
  if (!site) return;
  if (site.mode !== "embed") {
    const opened = window.open(site.url, "_blank", "noopener");
    if (!opened) flash("Safari did not open. Tap again, or allow pop-ups for this app.");
    return;
  }
  update((s) => {
    s.live.siteId = id;
    s.screen = "site";
  });
}

export function mountSite(node, state) {
  buildSite(node, state);
  node._patch = (s) => syncSite(node, s);
}

function embeddable(url) {
  return /^https?:\/\//i.test(url || "") && !/VIDEO_ID/.test(url);
}

function buildSite(node, state) {
  const site = state.sites.find((s) => s.id === state.live.siteId);
  clear(node);
  node._gesturing = false;
  if (!site) {
    node._id = null;
    node.appendChild(el("div", { class: "site-miss" }, [el("h1", { class: "h-display silver", text: "NO SITE" })]));
    return;
  }
  node._id = site.id;
  node._url = site.url;
  node._mode = site.mode;
  if (site.mode !== "embed" || !embeddable(site.url)) {
    node.appendChild(el("div", { class: "site-miss" }, [
      starsLabel(site.mode === "safari" ? "SAFARI" : "EMBED"),
      el("h1", { class: "h-display silver", text: site.name })
    ]));
    return;
  }
  const view = el("div", { class: "site-view" });
  const scaler = el("div", { class: "site-scaler" });
  const iframe = document.createElement("iframe");
  iframe.src = site.url;
  iframe.title = site.name;
  iframe.setAttribute("referrerpolicy", "no-referrer");
  iframe.setAttribute("allow", "autoplay; fullscreen; picture-in-picture");
  scaler.appendChild(iframe);
  view.appendChild(scaler);
  node.appendChild(view);
  node._view = view;
  node._scaler = scaler;
  node._iframe = iframe;
  node._frame = { x: site.x, y: site.y, scale: site.scale };
  layoutSite(node);
  applyFrame(node);
  bindFrame(node, site.id);
  node._relayout = () => {
    layoutSite(node);
    applyFrame(node);
  };
  requestAnimationFrame(() => {
    if (node._relayout) node._relayout();
  });
}

function syncSite(node, state) {
  const site = state.sites.find((s) => s.id === state.live.siteId);
  if (!site || site.id !== node._id || site.url !== node._url || site.mode !== node._mode) {
    buildSite(node, state);
    node._patch = (s) => syncSite(node, s);
    return;
  }
  if (node._gesturing || !node._scaler) return;
  node._frame = { x: site.x, y: site.y, scale: site.scale };
  applyFrame(node);
}

function layoutSite(node) {
  if (!node._iframe) return;
  const w = node.clientWidth || 1280;
  const h = node.clientHeight || 720;
  node._iframe.style.width = w + "px";
  node._iframe.style.height = Math.round(h * 4) + "px";
  node._baseW = w;
  node._baseH = h;
}

function applyFrame(node) {
  if (!node._scaler || !node._frame) return;
  const f = node._frame;
  node._scaler.style.transform = "translate(" + f.x + "px," + f.y + "px) scale(" + f.scale + ")";
}

function bindFrame(node, id) {
  const view = node._view;
  const ptrs = new Map();
  let base = null;
  view.addEventListener("pointerdown", (e) => {
    if (!document.body.classList.contains("controls-open")) return;
    view.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    base = { ...node._frame, pts: snapshot(ptrs) };
    node._gesturing = true;
  });
  view.addEventListener("pointermove", (e) => {
    if (!ptrs.has(e.pointerId) || !base) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) {
      const p0 = [...base.pts.values()][0];
      const p1 = [...ptrs.values()][0];
      node._frame = { scale: base.scale, x: base.x + (p1.x - p0.x), y: base.y + (p1.y - p0.y) };
    } else {
      const a0 = [...base.pts.values()];
      const a1 = [...ptrs.values()];
      const d0 = Math.hypot(a0[0].x - a0[1].x, a0[0].y - a0[1].y) || 1;
      const d1 = Math.hypot(a1[0].x - a1[1].x, a1[0].y - a1[1].y) || 1;
      const scale = clamp(base.scale * (d1 / d0), 0.4, 4);
      const mid0 = { x: (a0[0].x + a0[1].x) / 2, y: (a0[0].y + a0[1].y) / 2 };
      const mid1 = { x: (a1[0].x + a1[1].x) / 2, y: (a1[0].y + a1[1].y) / 2 };
      node._frame = {
        scale: scale,
        x: mid1.x - (mid0.x - base.x) * (scale / base.scale),
        y: mid1.y - (mid0.y - base.y) * (scale / base.scale)
      };
    }
    applyFrame(node);
  });
  const end = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (ptrs.size === 0) {
      base = null;
      node._gesturing = false;
      const frame = node._frame;
      update((s) => {
        const site = s.sites.find((row) => row.id === id);
        if (!site) return;
        site.x = frame.x;
        site.y = frame.y;
        site.scale = frame.scale;
      });
    } else {
      base = { ...node._frame, pts: snapshot(ptrs) };
    }
  };
  view.addEventListener("pointerup", end);
  view.addEventListener("pointercancel", end);
}

function snapshot(map) {
  const out = new Map();
  for (const [k, v] of map) out.set(k, { x: v.x, y: v.y });
  return out;
}
