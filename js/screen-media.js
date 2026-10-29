import { el, clear, topbar } from "./util.js";
import { update } from "./state.js";
import { mediaSrc } from "./media-db.js";

let liveVideo = null;

export function getLiveVideo() {
  return liveVideo;
}

export function mountMedia(node, state) {
  paintGrid(node, state);
  node._patch = (s) => {
    const sig = s.media.map((m) => [m.id, m.name, m.kind].join(":")).join("|") + "|" + s.brand.title;
    if (sig === node._sig && node.firstChild) return;
    node._sig = sig;
    paintGrid(node, s);
  };
}

function paintGrid(node, state) {
  clear(node);
  node._sig = state.media.map((m) => [m.id, m.name, m.kind].join(":")).join("|") + "|" + state.brand.title;
  node.appendChild(topbar(state.brand, "GRAPHICS"));
  const grid = el("div", { class: "tile-grid" });
  if (!state.media.length) {
    node.appendChild(el("div", { class: "dash" }, [
      el("p", { class: "subhead", text: "GRAPHICS" })
    ]));
    return;
  }
  for (const item of state.media) grid.appendChild(mediaTile(item));
  node.appendChild(el("div", { class: "dash" }, [el("div", { class: "dash-scroll" }, [grid])]));
}

function mediaTile(item) {
  const btn = el("button", { type: "button", class: "tile-btn" });
  const mark = el("div", { class: "tile-mark", text: kindLetter(item) });
  btn.appendChild(mark);
  btn.appendChild(el("div", { class: "tile-name", text: item.name || "Untitled" }));
  btn.appendChild(el("div", { class: "tile-mode", text: (item.kind || "file").toUpperCase() }));
  btn.addEventListener("click", () => {
    update((s) => {
      s.live.mediaId = item.id;
      s.screen = "mediashow";
    });
  });
  const token = {};
  btn._token = token;
  mediaSrc(item).then((src) => {
    if (btn._token !== token || !src || item.kind !== "image") return;
    const img = el("img", { src: src, alt: "", draggable: "false" });
    img.style.width = "100%";
    img.style.height = "3.2em";
    img.style.objectFit = "cover";
    img.style.borderRadius = "0.25em";
    img.addEventListener("error", () => img.remove());
    mark.replaceWith(img);
  }).catch(() => {});
  return btn;
}

function kindLetter(item) {
  if (item.kind === "video") return "▶";
  if (item.kind === "pdf") return "PDF";
  if (item.kind === "page") return "WEB";
  const ch = String(item.name || "?").trim().charAt(0);
  return ch.toUpperCase() || "?";
}

export function mountMediaShow(node, state) {
  const item = state.media.find((m) => m.id === state.live.mediaId);
  clear(node);
  liveVideo = null;
  if (!item) {
    node.appendChild(el("div", { class: "site-miss" }, [el("h1", { class: "h-display silver", text: "NO GRAPHIC" })]));
    node._patch = () => {};
    return;
  }
  const holder = el("div", { class: "mfull" });
  node.appendChild(holder);
  const token = {};
  node._token = token;
  node._itemId = item.id;
  mediaSrc(item).then((src) => {
    if (node._token !== token) return;
    if (!src) {
      holder.appendChild(el("div", { class: "muted-note", text: item.name || "Missing file" }));
      return;
    }
    if (item.kind === "image") {
      const img = el("img", { src: src, alt: item.name || "", draggable: "false" });
      img.addEventListener("error", () => {
        img.replaceWith(el("div", { class: "muted-note", text: item.name || "Image" }));
      });
      holder.appendChild(img);
    } else if (item.kind === "video") {
      const video = document.createElement("video");
      video.src = src;
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "");
      video.play().catch(() => {});
      holder.appendChild(video);
      liveVideo = video;
    } else {
      const frame = document.createElement("iframe");
      frame.src = src;
      frame.title = item.name || "Media";
      holder.appendChild(frame);
    }
  }).catch(() => {
    if (node._token !== token) return;
    holder.appendChild(el("div", { class: "muted-note", text: item.name || "Missing file" }));
  });
  node._patch = (s) => {
    if (s.live.mediaId !== node._itemId) mountMediaShow(node, s);
  };
}
