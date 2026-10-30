/* AP race calls via the NYT results JSON.
   Counts only seats won in races called this cycle (outcome.won is non-empty).
   No holdover seats and no majority math. Party comes from
   candidate_metadata[id].party.nyt_id: DEM, GOP, or anything else.
   The same pull also builds a per-state summary for the results maps. */

const POLL_MS = 60000;
const KINDS = ["senate", "house", "governor"];

let getDate = () => "2026-11-03";
let activeDate = "";
let timer = null;
let listening = false;
const store = { senate: null, house: null, governor: null };
const listeners = new Set();

function kindOf(chamber) {
  return KINDS.includes(chamber) ? chamber : "senate";
}

export function nytResultsUrl(date, chamber) {
  return "https://static01.nyt.com/elections-assets/pages/data/" + date + "/results-" + kindOf(chamber) + ".json";
}

function winners(race) {
  return race && race.outcome && Array.isArray(race.outcome.won) ? race.outcome.won.filter(Boolean) : [];
}

function partyOf(race, id) {
  const meta = (race && race.candidate_metadata) || {};
  const row = meta[id];
  const party = row && row.party && row.party.nyt_id;
  if (party === "DEM") return "D";
  if (party === "GOP") return "R";
  return "O";
}

function stateOf(race) {
  const unit = race && race.top_reporting_unit;
  const st = (unit && (unit.state_postal || unit.state_abb)) || String((race && race.nyt_id) || "").slice(0, 2);
  return /^[A-Z]{2}$/.test(st) ? st : "";
}

export function tallyRaces(races) {
  const counts = { d: 0, r: 0, other: 0, called: 0, total: 0 };
  if (!Array.isArray(races)) return counts;
  counts.total = races.length;
  for (const race of races) {
    const won = winners(race);
    if (!won.length) continue;
    counts.called += 1;
    for (const id of won) {
      const p = partyOf(race, id);
      if (p === "D") counts.d += 1;
      else if (p === "R") counts.r += 1;
      else counts.other += 1;
    }
  }
  return counts;
}

/* Per-state summary. party is R, D, O, split (called for different parties),
   or pending (nothing called yet). partial is true when some but not all
   races in that state are called. */
export function statesFromRaces(races) {
  const out = {};
  if (!Array.isArray(races)) return out;
  for (const race of races) {
    const st = stateOf(race);
    if (!st) continue;
    const row = out[st] || (out[st] = { r: 0, d: 0, o: 0, called: 0, total: 0, party: "pending", partial: false });
    row.total += 1;
    const won = winners(race);
    if (!won.length) continue;
    row.called += 1;
    for (const id of won) {
      const p = partyOf(race, id);
      if (p === "R") row.r += 1;
      else if (p === "D") row.d += 1;
      else row.o += 1;
    }
  }
  for (const st of Object.keys(out)) {
    const row = out[st];
    if (!row.called) continue;
    row.partial = row.called < row.total;
    const top = Math.max(row.r, row.d, row.o);
    const leaders = [["R", row.r], ["D", row.d], ["O", row.o]].filter((x) => x[1] === top);
    row.party = leaders.length === 1 ? leaders[0][0] : "split";
  }
  return out;
}

export function tallyPayload(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.races)) return null;
  return tallyRaces(data.races);
}

export function onSeats(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function fresh(chamber) {
  const row = store[kindOf(chamber)];
  if (!row || row.date !== activeDate || !row.tally) return null;
  return row;
}

export function getSeats(chamber) {
  const row = fresh(chamber);
  return row ? row.tally : null;
}

export function getStateMap(chamber) {
  const row = fresh(chamber);
  return row ? row.states : null;
}

export function startSeats(dateFn) {
  if (dateFn) getDate = dateFn;
  pokeSeats();
  if (timer) clearInterval(timer);
  timer = setInterval(pokeSeats, POLL_MS);
  if (!listening && typeof document !== "undefined") {
    listening = true;
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) pokeSeats();
    });
  }
}

export function pokeSeats() {
  const next = String(getDate() || "").trim();
  activeDate = /^\d{4}-\d{2}-\d{2}$/.test(next) ? next : "2026-11-03";
  for (const kind of KINDS) pull(kind);
}

async function pull(chamber) {
  const stamp = activeDate;
  try {
    const res = await fetch(nytResultsUrl(stamp, chamber), { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const tally = tallyPayload(data);
    if (!tally) throw new Error("shape");
    if (stamp !== activeDate) return;
    tally.updated = Date.now();
    store[chamber] = { date: stamp, tally: tally, states: statesFromRaces(data.races) };
    emit();
  } catch (e) {
    /* Keep the last good tally for this date. Never surface the error on air. */
  }
}

function emit() {
  for (const fn of listeners) {
    try { fn(); } catch (e) { /* a listener must not stop the poll */ }
  }
}
