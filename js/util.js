import { STAR_PATH } from "./data.js";

export function el(tag, props, children) {
  const node = document.createElement(tag);
  apply(node, props || {});
  appendAll(node, children);
  return node;
}

export function svg(tag, props, children) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  const p = props || {};
  for (const key of Object.keys(p)) {
    const val = p[key];
    if (val == null || val === false) continue;
    if (key === "text") node.textContent = String(val);
    else node.setAttribute(key, String(val));
  }
  appendAll(node, children);
  return node;
}

function apply(node, props) {
  for (const key of Object.keys(props)) {
    const val = props[key];
    if (val == null || val === false) continue;
    if (key === "class" || key === "className") node.className = val;
    else if (key === "text") node.textContent = val == null ? "" : String(val);
    else if (key.startsWith("on") && typeof val === "function") node.addEventListener(key.slice(2).toLowerCase(), val);
    else if (val === true) node.setAttribute(key, "");
    else node.setAttribute(key, String(val));
  }
}

function appendAll(node, children) {
  if (children == null || children === false) return;
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child == null || child === false) continue;
    if (Array.isArray(child)) appendAll(node, child);
    else if (child instanceof Node) node.appendChild(child);
    else node.appendChild(document.createTextNode(String(child)));
  }
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function starEl() {
  return svg("svg", { class: "star", viewBox: "0 0 24 24", "aria-hidden": "true" }, [
    svg("path", { d: STAR_PATH, fill: "currentColor" })
  ]);
}

export function starRow(count) {
  const row = el("span", { class: "stars", "aria-hidden": "true" });
  for (let i = 0; i < count; i++) row.appendChild(starEl());
  return row;
}

export function starsLabel(text) {
  return el("div", { class: "stars-row" }, [
    starRow(3),
    el("span", { class: "stars-label", text: text || "" }),
    starRow(3)
  ]);
}

export function topbar(brand, page) {
  const logo = el("span", { class: "logo-mark", text: brand.logo || "LOGO" });
  if (!brand.logo) logo.hidden = true;
  return el("div", { class: "topbar" }, [
    el("div", { class: "topbar-brand" }, [
      logo,
      starEl(),
      el("span", { text: brand.title || "ELECTION NIGHT" })
    ]),
    el("div", { class: "topbar-page", text: page || brand.show || "" })
  ]);
}

export function partyName(party) {
  if (party === "R") return "Republican";
  if (party === "D") return "Democrat";
  if (party === "I") return "Independent";
  return "Other";
}

export function formatVotes(n) {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString("en-US");
}

export function formatShare(votes, total) {
  if (!total) return "—";
  return ((Number(votes) || 0) / total * 100).toFixed(1) + "%";
}

export function formatClose(min) {
  const m = ((min % 1440) + 1440) % 1440;
  let h = Math.floor(m / 60);
  const mm = m % 60;
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return h + ":" + String(mm).padStart(2, "0") + " " + ap + " ET";
}

export function formatRemain(ms) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (hh > 48) {
    const days = Math.floor(hh / 24);
    return days + "d " + String(hh % 24).padStart(2, "0") + "h";
  }
  return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0") + ":" + String(ss).padStart(2, "0");
}

export function formatClock(ms, timeZone) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    }).format(new Date(ms));
  } catch (e) {
    return "";
  }
}

export function todayInZone(timeZone) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return fmt.format(new Date());
}

/* Convert a civil time in `timeZone` to a UTC epoch ms. */
export function zonedToUtc(year, month, day, hour, minute, timeZone) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  const parts = {};
  for (const p of fmt.formatToParts(new Date(utcGuess))) parts[p.type] = p.value;
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offset = asUTC - utcGuess;
  return utcGuess - offset;
}

export function electionInstant(dateStr, closeMin, timeZone) {
  const bits = String(dateStr || "2026-11-03").split("-").map(Number);
  const extraDays = Math.floor(closeMin / 1440);
  const mins = ((closeMin % 1440) + 1440) % 1440;
  const base = new Date(Date.UTC(bits[0], bits[1] - 1, bits[2] + extraDays));
  return zonedToUtc(
    base.getUTCFullYear(),
    base.getUTCMonth() + 1,
    base.getUTCDate(),
    Math.floor(mins / 60),
    mins % 60,
    timeZone || "America/New_York"
  );
}

export function pollSchedule(states, dateStr, timeZone, now) {
  const groups = new Map();
  for (const st of states) {
    const t = electionInstant(dateStr, st.closeMin, timeZone);
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t).push(st);
  }
  const times = [...groups.keys()].sort((a, b) => a - b);
  const nextIdx = times.findIndex((t) => t + 60000 > now);
  if (nextIdx === -1) return { done: true, nextTime: null, states: [], upcoming: [], closingNow: false };
  const nextTime = times[nextIdx];
  return {
    done: false,
    nextTime: nextTime,
    states: groups.get(nextTime),
    upcoming: times.slice(nextIdx + 1, nextIdx + 4).map((t) => ({ time: t, states: groups.get(t) })),
    closingNow: now >= nextTime
  };
}

export function resolvedStatus(st, settings, now) {
  if (st.status && st.status !== "auto") return st.status;
  if (!settings.autoClosePolls) return "open";
  const closeAt = electionInstant(settings.electionDate, st.closeMin, settings.timezone);
  return now >= closeAt ? "closed" : "open";
}

export function statusLabel(status) {
  if (status === "open") return "NOT CLOSED";
  if (status === "closed") return "CLOSED";
  if (status === "early") return "TOO EARLY";
  if (status === "R") return "CALLED R";
  if (status === "D") return "CALLED D";
  return status;
}

export function needText(seats, majority) {
  const n = majority - (Number(seats) || 0);
  if (n <= 0) return "MAJORITY";
  return n + " TO MAJORITY";
}

export function faviconFor(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (!host) return "";
    return "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(host) + "&sz=64";
  } catch (e) {
    return "";
  }
}

export function uid(prefix) {
  return prefix + "-" + Math.random().toString(36).slice(2, 8);
}

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function voteTotal(race) {
  return (race.candidates || []).reduce((sum, c) => sum + (Number(c.votes) || 0), 0);
}

export function calledCandidate(race) {
  if (!race || !race.calledId) return null;
  return (race.candidates || []).find((c) => c.id === race.calledId) || null;
}
