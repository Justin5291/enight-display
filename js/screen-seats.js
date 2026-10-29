import { el, clear, topbar, kalshiBadge } from "./util.js";
import { getSeats } from "./nyt.js";

export function mountSenateFeed(node, state) {
  paintSeat(node, state, "senate");
  node._patch = (s) => paintSeat(node, s, "senate");
}

export function mountHouseFeed(node, state) {
  paintSeat(node, state, "house");
  node._patch = (s) => paintSeat(node, s, "house");
}

function paintSeat(node, state, chamber) {
  const tally = getSeats(chamber);
  const name = chamber === "senate" ? "SENATE" : "HOUSE";
  clear(node);
  const row = el("div", { class: "seat-row" + (tally && tally.other > 0 ? " cols-3" : "") });
  row.appendChild(seatCol("r", "REPUBLICANS", tally ? String(tally.r) : "—"));
  row.appendChild(seatCol("d", "DEMOCRATS", tally ? String(tally.d) : "—"));
  if (tally && tally.other > 0) row.appendChild(seatCol("o", "IND / OTHER", String(tally.other)));
  const called = tally
    ? tally.called + " of " + tally.total + " races called"
    : "Waiting for calls";
  node.appendChild(topbar(state.brand, name));
  node.appendChild(el("div", { class: "seatboard" }, [
    row,
    el("div", { class: "seat-called", text: called }),
    el("div", { class: "seat-credit", text: "Race calls: AP via NYT" }),
    el("div", { class: "seat-sponsor" }, [kalshiBadge()])
  ]));
}

function seatCol(party, label, value) {
  return el("div", { class: "seat-col " + party }, [
    el("div", { class: "seat-kicker", text: label }),
    el("div", { class: "seat-big", text: value })
  ]);
}
