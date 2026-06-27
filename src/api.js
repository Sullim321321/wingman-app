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
export const getProfile = () => req("/me");
export const updateProfile = (preferences) =>
  req("/profile", { method: "PATCH", body: JSON.stringify({ preferences }) });

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
  req("/flight-status/" + encodeURIComponent(ident));
export const refreshTrip = (id) =>
  req("/trips/" + id + "/refresh", { method: "POST" });

// Concierge
export const sendConciergeMessage = (message, history = [], tripContext = []) =>
  req("/concierge", { method: "POST", body: JSON.stringify({ message, history, tripContext }) });

// Apple Wallet
export const getWalletPass = (legId) => req("/wallet/pass/" + legId);

// Uber deep link — no OAuth needed, opens Uber app pre-filled with airport pickup
export const getUberDeepLink = (airport) =>
  req("/uber/deeplink?airport=" + encodeURIComponent(airport));

// Subscription
export const getSubscriptionPlans = () => req("/subscription/plans");
export const createSubscriptionIntent = (plan) =>
  req("/subscription/create-intent", { method: "POST", body: JSON.stringify({ plan }) });
export const activateSubscription = (plan, paymentMethodId) =>
  req("/subscription/activate", { method: "POST", body: JSON.stringify({ plan, payment_method_id: paymentMethodId }) });

// Export token getter for SubscriptionScreen
export const getToken = () => Promise.resolve(_token);

// Ground Intelligence (drive time, TSA wait, gate walk, connection math)
export const getGroundIntel = ({ airport, departureTime, fromGate, toGate, lat, lon, delayMinutes }) => {
  const params = new URLSearchParams({ airport, departure_time: departureTime });
  if (fromGate) params.set('from_gate', fromGate);
  if (toGate) params.set('to_gate', toGate);
  if (lat) params.set('lat', lat);
  if (lon) params.set('lon', lon);
  if (delayMinutes) params.set('delay_minutes', delayMinutes);
  return req('/ground-intel?' + params.toString());
};

export const getTsaWait = (airport) => {
  const now = new Date();
  return req(`/tsa-wait?airport=${encodeURIComponent(airport)}&hour=${now.getHours()}&dow=${now.getDay()}`);
};

// Award search (cash vs points rescue options)
export const searchAwards = ({ origin, destination, date, cabin = 'economy' }) =>
  req(`/awards/search?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&date=${encodeURIComponent(date)}&cabin=${encodeURIComponent(cabin)}`);

// Gmail scan with pasted email body
export const scanEmailBody = (emailBody, source = 'manual') =>
  req('/auth/gmail/scan', { method: 'POST', body: JSON.stringify({ emailBody, source }) });

// Duffel flight search + booking
export const searchFlights = (body) =>
  req("/flights/search", { method: "POST", body: JSON.stringify(body) });
export const getFlightOffer = (offerId) => req("/flights/offer/" + offerId);
export const bookFlight = (body) =>
  req("/flights/book", { method: "POST", body: JSON.stringify(body) });
export const getFlightOrders = () => req("/flights/orders");
