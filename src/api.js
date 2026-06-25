import { API_BASE } from "./config";

let _token = null;
export function setToken(t) { _token = t; }

// Retry fetch with exponential backoff
async function fetchWithRetry(url, opts = {}, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetch(url, opts);
      return r;
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(res => setTimeout(res, 500 * Math.pow(2, i)));
    }
  }
}

async function req(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (_token) headers.Authorization = "Bearer " + _token;
  let r;
  try {
    r = await fetchWithRetry(API_BASE + path, { ...opts, headers });
  } catch (e) {
    throw new Error("No connection — check your internet and try again.");
  }
  const text = await r.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch (e) { body = { raw: text }; }
  if (!r.ok) throw new Error(body.error || "HTTP " + r.status);
  return body;
}

export const requestCode = (email) =>
  req("/auth/request", { method: "POST", body: JSON.stringify({ email }) });

export const verifyCode = (email, code) =>
  req("/auth/verify", { method: "POST", body: JSON.stringify({ email, code }) });

export const getPrediction = ({ dep = "DEN", arr = "ASE" } = {}) =>
  req("/predict?dep=" + encodeURIComponent(dep) + "&arr=" + encodeURIComponent(arr));

export const registerPushToken = (pushToken) =>
  req("/push-token", { method: "POST", body: JSON.stringify({ pushToken }) });

export const getMe = () => req("/me");

// Gmail
export const getGmailConnectUrl = () => req("/auth/gmail/connect");
export const triggerGmailScan = () =>
  req("/auth/gmail/scan", { method: "POST" });

// Trips
export const getTrips = () => req("/trips");
export const createTrip = (data) =>
  req("/trips", { method: "POST", body: JSON.stringify(data) });
export const deleteTrip = (id) =>
  req("/trips/" + id, { method: "DELETE" });

// Activity feed
export const getActivity = (limit = 50) =>
  req("/activity?limit=" + limit);

// Flight status (FlightAware AeroAPI)
export const getFlightStatus = (ident) =>
  req("/flight-status?ident=" + encodeURIComponent(ident));
export const refreshTrip = (id) =>
  req("/trips/" + id + "/refresh", { method: "POST" });

// Concierge
export const sendConciergeMessage = (message, history = []) =>
  req("/concierge", { method: "POST", body: JSON.stringify({ message, history }) });
