import { el, clear, topbar, starsLabel, partyName, formatVotes, formatShare, voteTotal, calledCandidate } from "./util.js";

export function mountCall(node, state) {
  paintCall(node, state);
  node._patch = (s) => paintCall(node, s);
}

export function mountTally(node, state) {
  paintTally(node, state);
  node._patch = (s) => paintTally(node, s);
}

function findRace(state) {
  return state.races.find((r) => r.id === state.live.raceId) || state.races[0] || null;
}

function paintCall(node, state) {
  const race = findRace(state);
  clear(node);
  node.appendChild(topbar(state.brand, "RACE CALL"));
  if (!race) {
    node.appendChild(el("div", { class: "call" }, [
      starsLabel("NO RACE"),
      el("h1", { class: "h-display call-name silver", text: "ADD A RACE" })
    ]));
    return;
  }
  const cand = calledCandidate(race);
  const total = voteTotal(race);
  const card = el("div", { class: "call", "data-party": cand ? cand.party : "" });
  if (!cand) {
    card.appendChild(starsLabel("AWAITING CALL"));
    card.appendChild(fitHero(race.title, "call-name"));
    card.appendChild(el("div", { class: "subhead", text: race.short || "" }));
  } else {
    card.appendChild(starsLabel("PROJECTED WINNER"));
    card.appendChild(el("div", { class: "subhead", text: race.title }));
    card.appendChild(fitHero(cand.name, "call-name"));
    card.appendChild(el("div", { class: "call-party " + cand.party, text: partyName(cand.party) }));
    if (total > 0) {
      const bits = [formatShare(cand.votes, total)];
      if (race.reporting > 0) bits.push(race.reporting + "% reporting");
      card.appendChild(el("div", { class: "subhead", text: bits.join("    ·    ") }));
    } else if (race.reporting > 0) {
      card.appendChild(el("div", { class: "subhead", text: race.reporting + "% reporting" }));
    }
  }
  node.appendChild(card);
}

function paintTally(node, state) {
  const race = findRace(state);
  clear(node);
  node.appendChild(topbar(state.brand, "TALLY"));
  if (!race) {
    node.appendChild(el("p", { class: "subhead", text: "Add a race in Setup" }));
    return;
  }
  const total = voteTotal(race);
  const box = el("div", { class: "tally" });
  box.appendChild(el("div", { class: "tally-head" }, [
    el("h1", { class: "tally-title silver", text: race.title }),
    el("div", { class: "reporting", text: (Number(race.reporting) || 0) + "% IN" })
  ]));
  for (const cand of race.candidates) {
    const share = total ? (cand.votes / total) * 100 : 0;
    box.appendChild(el("div", { class: "cand" }, [
      el("div", { class: "cand-name", text: cand.name }),
      el("div", { class: "meter" }, [el("i", { class: cand.party, style: "width:" + share.toFixed(2) + "%" })]),
      el("div", { class: "cand-votes", text: formatVotes(cand.votes) }),
      el("div", { class: "cand-pct", text: formatShare(cand.votes, total) })
    ]));
  }
  node.appendChild(box);
}

function fitHero(text, extra) {
  const h = el("h1", { class: "h-display silver " + extra, text: text });
  if (text.length > 14) h.style.fontSize = "4.2em";
  if (text.length > 22) h.style.fontSize = "3.1em";
  return h;
}
