// offlineCache.js — offline-first caching layer
// Wraps AsyncStorage to cache trips, flight status, alerts, and airport intel
// so the app works without cell service (airplane mode, poor signal, etc.)
//
// Strategy:
//  - On successful API fetch: write to cache with timestamp
//  - On network failure: read from cache, return data + { cached: true, cachedAt }
//  - Staleness thresholds: trips 6h, flight status 5min, alerts 30min, airport intel 24h

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  TRIPS:          "wm_cache_trips",
  FLIGHT_STATUS:  "wm_cache_flight_",  // + ident
  ALERTS:         "wm_cache_alerts",
  ACTIVITY:       "wm_cache_activity",
  AIRPORT_DINING: "wm_cache_dining_",  // + iata
  AIRPORT_NAV:    "wm_cache_nav_",     // + iata
  CITY_TRANSPORT: "wm_cache_citytx_",  // + iata
  POINTS:         "wm_cache_points",
};

const TTL = {
  TRIPS:          6  * 60 * 60 * 1000,  // 6 hours
  FLIGHT_STATUS:  5  * 60 * 1000,       // 5 minutes
  ALERTS:         30 * 60 * 1000,       // 30 minutes
  ACTIVITY:       30 * 60 * 1000,       // 30 minutes
  AIRPORT_DINING: 24 * 60 * 60 * 1000,  // 24 hours
  AIRPORT_NAV:    24 * 60 * 60 * 1000,  // 24 hours
  CITY_TRANSPORT: 24 * 60 * 60 * 1000,  // 24 hours
  POINTS:         5  * 60 * 1000,       // 5 minutes
};

async function write(key, data) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch (_) {}
}

async function read(key, ttl) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    const age = Date.now() - ts;
    return { data, cachedAt: ts, stale: age > ttl };
  } catch (_) { return null; }
}

// ── Public API ───────────────────────────────────────────────────────────────

// Wraps any async fetch fn with cache-on-success, fallback-to-cache-on-failure
// Returns: { data, cached: bool, stale: bool, cachedAt: number|null }
export async function withCache(cacheKey, ttl, fetchFn) {
  try {
    const data = await fetchFn();
    await write(cacheKey, data);
    return { data, cached: false, stale: false, cachedAt: null };
  } catch (e) {
    const cached = await read(cacheKey, ttl);
    if (cached) {
      return { data: cached.data, cached: true, stale: cached.stale, cachedAt: cached.ts };
    }
    throw e; // nothing in cache either — re-throw
  }
}

// Convenience wrappers for each data type
export const cacheKeys = KEYS;
export const cacheTTL  = TTL;

export async function getCachedTrips(fetchFn) {
  return withCache(KEYS.TRIPS, TTL.TRIPS, fetchFn);
}

export async function getCachedFlightStatus(ident, fetchFn) {
  return withCache(KEYS.FLIGHT_STATUS + ident, TTL.FLIGHT_STATUS, fetchFn);
}

export async function getCachedAlerts(fetchFn) {
  return withCache(KEYS.ALERTS, TTL.ALERTS, fetchFn);
}

export async function getCachedActivity(fetchFn) {
  return withCache(KEYS.ACTIVITY, TTL.ACTIVITY, fetchFn);
}

export async function getCachedAirportDining(iata, fetchFn) {
  return withCache(KEYS.AIRPORT_DINING + iata, TTL.AIRPORT_DINING, fetchFn);
}

export async function getCachedAirportNav(iata, fetchFn) {
  return withCache(KEYS.AIRPORT_NAV + iata, TTL.AIRPORT_NAV, fetchFn);
}

export async function getCachedCityTransport(iata, fetchFn) {
  return withCache(KEYS.CITY_TRANSPORT + iata, TTL.CITY_TRANSPORT, fetchFn);
}

export async function getCachedPoints(fetchFn) {
  return withCache(KEYS.POINTS, TTL.POINTS, fetchFn);
}

// Clear all caches (call on sign-out)
export async function clearAllCaches() {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const wmKeys = allKeys.filter(k => k.startsWith("wm_cache_"));
    if (wmKeys.length > 0) await AsyncStorage.multiRemove(wmKeys);
  } catch (_) {}
}

// Human-readable staleness label
export function staleLabel(cachedAt) {
  if (!cachedAt) return null;
  const age = Date.now() - cachedAt;
  if (age < 60_000)      return "just now";
  if (age < 3_600_000)   return `${Math.floor(age / 60_000)}m ago`;
  if (age < 86_400_000)  return `${Math.floor(age / 3_600_000)}h ago`;
  return `${Math.floor(age / 86_400_000)}d ago`;
}
