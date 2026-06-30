// Wingman Destination Etchings
// Fine-line Victorian engraving illustrations for the parchment Next Up card.
// Maps IATA destination codes → local etching asset.
// For unmapped destinations, returns null (card renders without illustration).

const ETCHINGS = {
  // North America
  LAX: require("../assets/etchings/los_angeles.png"),
  BUR: require("../assets/etchings/los_angeles.png"),
  SNA: require("../assets/etchings/los_angeles.png"),
  LGB: require("../assets/etchings/los_angeles.png"),
  JFK: require("../assets/etchings/new_york.png"),
  LGA: require("../assets/etchings/new_york.png"),
  EWR: require("../assets/etchings/new_york.png"),
  MIA: require("../assets/etchings/miami.png"),
  FLL: require("../assets/etchings/miami.png"),
  PBI: require("../assets/etchings/miami.png"),

  // Europe
  LHR: require("../assets/etchings/london.png"),
  LGW: require("../assets/etchings/london.png"),
  STN: require("../assets/etchings/london.png"),
  LCY: require("../assets/etchings/london.png"),
  CDG: require("../assets/etchings/paris.png"),
  ORY: require("../assets/etchings/paris.png"),

  // Asia-Pacific
  NRT: require("../assets/etchings/tokyo.png"),
  HND: require("../assets/etchings/tokyo.png"),
  SIN: require("../assets/etchings/singapore.png"),
  DXB: require("../assets/etchings/dubai.png"),
  AUH: require("../assets/etchings/dubai.png"),
  DWC: require("../assets/etchings/dubai.png"),

  // Leisure
  DPS: require("../assets/etchings/bali.png"),  // Bali
  ZRH: require("../assets/etchings/swiss_alps.png"),
  GVA: require("../assets/etchings/swiss_alps.png"),
  BSL: require("../assets/etchings/swiss_alps.png"),
};

/**
 * Returns the etching image source for a given IATA code, or null if none exists.
 * @param {string} iata - 3-letter IATA airport code (e.g. "LAX")
 * @returns {object|null} - React Native image source or null
 */
export function getEtching(iata) {
  if (!iata) return null;
  return ETCHINGS[iata.toUpperCase()] || null;
}

export default ETCHINGS;
