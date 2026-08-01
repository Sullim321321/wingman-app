// transport.js (app) — how a leg is spoken, by mode. Mirror of the server seam, but
// only the display half the UI needs: what mode is this, where does it start/end
// (air uses origin/destination, rail uses station_from/station_to), and the words for
// it (gate vs platform, airport vs station, flight vs train). So a train reads as a
// train instead of borrowing a flight's vocabulary.
import { displayName as flightDisplayName } from "./flightid";

const MODE_OF_TYPE = { flight: "air", train: "rail" };

const VOCAB = {
  air:  { mode: "air",  vehicle: "flight", hub: "airport", node: "gate",     terminal: "terminal" },
  rail: { mode: "rail", vehicle: "train",  hub: "station",  node: "platform", terminal: null },
};

const nonEmpty = (v) => v != null && String(v).trim() !== "";

export function modeOf(leg) {
  return MODE_OF_TYPE[String(leg?.type || "").toLowerCase()] || null;
}

export function isTransportLeg(leg) {
  return modeOf(leg) != null;
}

// Both ends of the journey, from whichever field the leg used. Rail prefers stations,
// air prefers origin/destination; each falls back to the other so a mixed row resolves.
export function endpointsOf(leg) {
  if (!leg) return { from: null, to: null };
  const mode = modeOf(leg);
  const air = { from: leg.origin, to: leg.destination };
  const rail = { from: leg.station_from, to: leg.station_to };
  const order = mode === "rail" ? [rail, air] : [air, rail];
  const pick = (k) => (nonEmpty(order[0][k]) ? order[0][k] : (nonEmpty(order[1][k]) ? order[1][k] : null));
  return { from: pick("from"), to: pick("to") };
}

export function vocab(mode) {
  return VOCAB[mode] || VOCAB.air;
}

// Human name: air delegates to flightid; rail is operator + service, else the route.
export function displayName(leg = {}) {
  const mode = modeOf(leg);
  if (mode === "air") return flightDisplayName(leg);
  const { from, to } = endpointsOf(leg);
  const route = nonEmpty(from) && nonEmpty(to) ? `${from} → ${to}` : (nonEmpty(to) ? String(to) : null);
  if (mode === "rail") {
    const operator = nonEmpty(leg.carrier) ? String(leg.carrier).trim() : null;
    const service = nonEmpty(leg.flight_number) ? String(leg.flight_number).trim() : null;
    return [operator, service].filter(Boolean).join(" ") || route || null;
  }
  return route || null;
}
