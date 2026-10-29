import { getState } from "./state.js";
import { pageOf, labelFor, pageAlive, goPage } from "./pages.js";
import { el, clear, faviconFor } from "./util.js";

const STORE = "enight-recent-v1";

let onGear = () => {};
let stack = [];
let lastKey = null;
let lastPage = null;
let recentSig = "";

if (typeof sessionStorage !== "undefined") stack = loadStack();

export function initDock(opts) {
  onGear = (opts && opts.onGear) || onGear;
  const home = document.getElementById("dock-home");
  const gear = document.getElementById("dock-gear");
  if (home && opts && opts.onHome) home.addEventListener("click", opts.onHome);
  if (gear) gear.addEventListener("click", () => onGear(sectionFor(getState().screen)));
}

export function trackPage(state) {
  const page = pageOf(state);
  if (lastKey && lastKey !== page.key) {
    if (lastPage && lastPage.screen !== "home") {
      stack = stack.filter((item) => item.key !== lastPage.key);
      stack.unshift(strip(lastPage));
    }
    if (stack.length > 8) stack.length = 8;
    saveStack();
  }
  const trimmed = stack.filter((item) => item.key !== page.key);
  if (trimmed.length !== stack.length) {
    stack = trimmed;
    saveStack();
  }
  lastKey = page.key;
  lastPage = page;
  paintRecent(state);
}

function paintRecent(state) {
  const slot = document.getElementById("dock-recent");
  if (!slot) return;
  const view = stack.filter((item) => item.key !== pageOf(state).key && pageAlive(state, item)).slice(0, 3);
  const sig = view.map((item) => item.key + ":" + labelFor(state, item)).join("|");
  if (sig === recentSig) return;
  recentSig = sig;
  clear(slot);
  for (const page of view) {
    const btn = el("button", { type: "button", class: "dock-chip" });
    btn.appendChild(markFor(state, page));
    btn.appendChild(el("span", { class: "dock-chip-label", text: labelFor(state, page) }));
    btn.addEventListener("click", () => goPage(page));
    slot.appendChild(btn);
  }
}

function markFor(state, page) {
  const mark = el("span", { class: "dock-chip-mark", text: letter(labelFor(state, page)) });
  if (page.screen === "site" && page.siteId) {
    const site = state.sites.find((row) => row.id === page.siteId);
    const src = site && faviconFor(site.url);
    if (src) {
      const img = document.createElement("img");
      img.alt = "";
      img.draggable = false;
      img.referrerPolicy = "no-referrer";
      img.addEventListener("load", () => {
        mark.textContent = "";
        mark.appendChild(img);
      });
      img.src = src;
    }
  }
  return mark;
}

function letter(name) {
  const ch = String(name || "?").trim().charAt(0);
  return ch.toUpperCase() || "?";
}

function strip(page) {
  return {
    key: page.key,
    screen: page.screen,
    label: page.label,
    segmentId: page.segmentId || null,
    raceId: page.raceId || null,
    marketId: page.marketId || null,
    siteId: page.siteId || null,
    mediaId: page.mediaId || null
  };
}

function sectionFor(screen) {
  if (screen === "home" || screen === "senate" || screen === "house") return "categories";
  if (screen === "senateManual") return "senate";
  if (screen === "houseManual") return "house";
  if (screen === "map" || screen === "countdown") return "states";
  if (screen === "call" || screen === "tally") return "races";
  if (screen === "segment" || screen === "holding") return "segments";
  if (screen === "kalshi") return "kalshi";
  if (screen === "site" || screen === "sites") return "sites";
  if (screen === "mediashow" || screen === "media") return "media";
  return "show";
}

function loadStack() {
  try {
    const raw = sessionStorage.getItem(STORE);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.filter((item) => item && item.key && item.screen && item.screen !== "home");
  } catch (e) {
    return [];
  }
}

function saveStack() {
  try {
    sessionStorage.setItem(STORE, JSON.stringify(stack.slice(0, 8)));
  } catch (e) { /* private mode */ }
}
