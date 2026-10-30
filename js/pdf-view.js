/* PDF pages rendered with the vendored pdf.js (vendor/pdfjs), no CDN.
   Each page fits the screen; pages stack top to bottom. After a zoom settles,
   pages on screen re-render sharper. */
import { makeZoomable } from "./zoom-view.js";

const MAX_PIXELS = 12e6;
let lib = null;
let current = null;

async function pdfjs() {
  if (lib) return lib;
  const mod = await import("../vendor/pdfjs/pdf.min.mjs");
  mod.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;
  lib = mod;
  return lib;
}

export function closePdf() {
  if (current) {
    const doc = current;
    current = null;
    try { doc.destroy(); } catch (e) { /* gone */ }
  }
}

export async function showPdf(holder, src, isAlive, key) {
  closePdf();
  const mod = await pdfjs();
  const res = await fetch(src);
  if (!res.ok) throw new Error("PDF " + res.status);
  const data = await res.arrayBuffer();
  if (!isAlive()) return null;
  const doc = await mod.getDocument({ data: data, isEvalSupported: false }).promise;
  if (!isAlive()) { doc.destroy(); return null; }
  current = doc;
  const view = document.createElement("div");
  view.className = "pdf-view";
  const stack = document.createElement("div");
  stack.className = "pdf-stack";
  view.appendChild(stack);
  holder.appendChild(view);
  const pages = [];
  const vw = view.clientWidth || holder.clientWidth || 1024;
  const vh = view.clientHeight || holder.clientHeight || 576;
  stack.style.width = vw + "px";
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    if (!isAlive()) return null;
    const base = page.getViewport({ scale: 1 });
    const fit = Math.min(vw / base.width, vh / base.height);
    const cssW = Math.floor(base.width * fit);
    const cssH = Math.floor(base.height * fit);
    const slot = document.createElement("div");
    slot.className = "pdf-page";
    slot.style.width = cssW + "px";
    slot.style.height = cssH + "px";
    stack.appendChild(slot);
    const row = { page: page, slot: slot, fit: fit, cssW: cssW, cssH: cssH, res: 0, busy: false };
    pages.push(row);
  }
  const zoom = makeZoomable(view, stack, {
    key: key,
    onSettle: (scale) => {
      const r = view.getBoundingClientRect();
      for (const row of pages) {
        const b = row.slot.getBoundingClientRect();
        const onScreen = b.bottom > r.top && b.top < r.bottom && b.right > r.left && b.left < r.right;
        render(row, onScreen ? scale : 1);
      }
    }
  });
  for (const row of pages) {
    if (!isAlive()) return null;
    await render(row, 1);
  }
  /* Sharpen pages at the restored zoom once everything has a first render. */
  if (zoom.scale() > 1) zoom.relayout();
  return { zoom: zoom, pages: doc.numPages };
}

async function render(row, scale) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  let ratio = dpr * Math.min(Math.max(1, scale), 4);
  const area = row.cssW * row.cssH * ratio * ratio;
  if (area > MAX_PIXELS) ratio = Math.sqrt(MAX_PIXELS / (row.cssW * row.cssH));
  ratio = Math.round(ratio * 4) / 4;
  if (row.busy || Math.abs(ratio - row.res) < 0.2) return;
  row.busy = true;
  try {
    const viewport = row.page.getViewport({ scale: row.fit * ratio });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = row.cssW + "px";
    canvas.style.height = row.cssH + "px";
    await row.page.render({ canvasContext: canvas.getContext("2d"), viewport: viewport }).promise;
    const old = row.slot.querySelector("canvas");
    row.slot.appendChild(canvas);
    if (old) { old.width = 0; old.height = 0; old.remove(); }
    row.res = ratio;
  } catch (e) {
    /* keep whatever is already on screen */
  } finally {
    row.busy = false;
  }
}
