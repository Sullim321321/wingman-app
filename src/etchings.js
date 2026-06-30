// Wingman Destination Etchings
// Fine-line Victorian engraving illustrations for the parchment Next Up card.
// Maps IATA destination codes → local etching asset (WebP, ~78% smaller than PNG).
// For unmapped destinations, returns null (card renders without illustration).

const ETCHINGS = {
  // North America
  LAX: require("../assets/etchings/los_angeles.webp"),
  BUR: require("../assets/etchings/los_angeles.webp"),
  SNA: require("../assets/etchings/los_angeles.webp"),
  LGB: require("../assets/etchings/los_angeles.webp"),
  JFK: require("../assets/etchings/new_york.webp"),
  LGA: require("../assets/etchings/new_york.webp"),
  EWR: require("../assets/etchings/new_york.webp"),
  MIA: require("../assets/etchings/miami.webp"),
  FLL: require("../assets/etchings/miami.webp"),
  PBI: require("../assets/etchings/miami.webp"),

  // Europe
  LHR: require("../assets/etchings/london.webp"),
  LGW: require("../assets/etchings/london.webp"),
  STN: require("../assets/etchings/london.webp"),
  LCY: require("../assets/etchings/london.webp"),
  CDG: require("../assets/etchings/paris.webp"),
  ORY: require("../assets/etchings/paris.webp"),

  // Asia-Pacific
  NRT: require("../assets/etchings/tokyo.webp"),
  HND: require("../assets/etchings/tokyo.webp"),
  SIN: require("../assets/etchings/singapore.webp"),
  DXB: require("../assets/etchings/dubai.webp"),
  AUH: require("../assets/etchings/dubai.webp"),
  DWC: require("../assets/etchings/dubai.webp"),

  // Leisure
  DPS: require("../assets/etchings/bali.webp"),       // Bali
  ZRH: require("../assets/etchings/swiss_alps.webp"),
  GVA: require("../assets/etchings/swiss_alps.webp"),
  BSL: require("../assets/etchings/swiss_alps.webp"),
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
