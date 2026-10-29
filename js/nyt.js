/* AP race calls via the NYT results JSON.
   Counts only seats won in races called this cycle (outcome.won is non-empty).
   No holdover seats and no majority math. Party comes from
   candidate_metadata[id].party.nyt_id: DEM, GOP, or anything else. */

const POLL_MS = 60000;

let getDate = () => "2026-11-03";
let activeDate = "";
let timer = null;
let listening = false;
const store = { senate: null, house: null };
const listeners = new Set();

export function nytResultsUrl(date, chamber) {
  const which = chamber === "house" ? "house" : "senate";
  return "https://static01.nyt.com/elections-assets/pages/data/" + date + "/results-" + which + ".json";
}

export function tallyRaces(races) {
  const counts = { d: 0, r: 0, other: 0, called: 0, total: 0 };
  if (!Array.isArray(races)) return counts;
  counts.total = races.length;
  for (const race of races) {
    const won = race && race.outcome && Array.isArray(race.outcome.won) ? race.outcome.won.filter(Boolean) : [];
    if (!won.length) continue;
    counts.called += 1;
    const meta = (race && race.candidate_metadata) || {};
    for (const id of won) {
      const row = meta[id];
      const party = row && row.party && row.party.nyt_id;
      if (party === "DEM") counts.d += 1;
      else if (party === "GOP") counts.r += 1;
      else counts.other += 1;
    }
  }
  return counts;
}

export function tallyPayload(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.races)) return null;
  return tallyRaces(data.races);
}

export function onSeats(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSeats(chamber) {
  const row = store[chamber === "house" ? "house" : "senate"];
  if (!row || row.date !== activeDate || !row.tally) return null;
  return row.tally;
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
  pull("senate");
  pull("house");
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
    store[chamber] = { date: stamp, tally: tally };
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
