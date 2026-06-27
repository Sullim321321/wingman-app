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
  if (r.status === 402) {
    // Pro feature gate — throw a special error the UI can catch to show upsell
    const err = new Error(body.error || "pro_required");
    err.code = "pro_required";
    err.feature = body.feature || "";
    throw err;
  }
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
export const updateProfile = (data) =>
  req("/profile", { method: "PATCH", body: JSON.stringify(data) });

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

// ─── AMBIENT INGESTION ────────────────────────────────────────────────────────
// Natural language trip drafting ("One sentence. A complete trip drafted.")
export const draftTripFromText = (text) =>
  req("/trips/draft", { method: "POST", body: JSON.stringify({ text }) });

// Calendar sync — ingest iCal/Google Calendar events
export const syncCalendar = (events) =>
  req("/sync/calendar", { method: "POST", body: JSON.stringify({ events }) });

// Messages/SMS parsing — parse pasted itineraries or forwarded texts
export const parseMessages = (messages) =>
  req("/sync/messages", { method: "POST", body: JSON.stringify({ messages: Array.isArray(messages) ? messages : [{ body: messages, sender: "Manual", timestamp: new Date().toISOString() }] }) });

// ─── MONITORING ENGINE ────────────────────────────────────────────────────────
// Trip risk profile — downstream value at risk if upstream flight is delayed
export const getTripRiskProfile = (tripId) =>
  req("/trips/" + tripId + "/risk-profile");

// Disruption evaluation — compare rescue cost vs downstream loss
export const evaluateDisruption = ({ tripId, delayMinutes, rescueOptions }) =>
  req("/disruption/evaluate", {
    method: "POST",
    body: JSON.stringify({ trip_id: tripId, delay_minutes: delayMinutes, rescue_options: rescueOptions }),
  });

// ─── RESCUE DECISION ENGINE ───────────────────────────────────────────────────
// Rescue search — ranked options across cash and points
export const searchRescueOptions = ({ origin, destination, date, cabin = "economy", tripId }) =>
  req("/flights/rescue/search", {
    method: "POST",
    body: JSON.stringify({ origin, destination, date, cabin, trip_id: tripId }),
  });

// Autonomous rescue execution
export const executeRescue = ({ offerId, tripId, paymentMethod }) =>
  req("/flights/rescue/execute", {
    method: "POST",
    body: JSON.stringify({ offer_id: offerId, trip_id: tripId, payment_method: paymentMethod }),
  });

// ─── AUTONOMY POLICY ─────────────────────────────────────────────────────────
// Save user delegation rules — backend is at /policy (not /profile/policy)
export const updatePolicy = (policy) =>
  req("/policy", { method: "PATCH", body: JSON.stringify(policy) });

// Get current policy
export const getPolicy = () => req("/policy");

// ─── LEARNING LOOP ────────────────────────────────────────────────────────────
// Log post-trip outcome
export const logOutcome = ({ tripId, predictedDelay, actualDelay, rescueAccepted, notes }) =>
  req("/outcomes/log", {
    method: "POST",
    body: JSON.stringify({
      trip_id: tripId,
      predicted_delay: predictedDelay,
      actual_delay: actualDelay,
      rescue_accepted: rescueAccepted,
      notes,
    }),
  });

// ROI dashboard — total value saved, accepts period filter: '30d' | '90d' | 'all'
export const getInsightsROI = (period = "all") => req("/insights/roi?period=" + encodeURIComponent(period));

// Locale / currency preferences
export const updateLocale = ({ locale, currency }) =>
  req("/profile/locale", { method: "PATCH", body: JSON.stringify({ locale, currency }) });

// ─── TRANSFER-WINDOW RISK SCORING ─────────────────────────────────────────────
// GET /trips/:tripId/risk — connection risk scores + hotel alerts
export const getTripRisk = (tripId) =>
  req("/trips/" + tripId + "/risk");

// ─── RESCUE DECISION ENGINE (v2.2) ───────────────────────────────────────────
// POST /trips/:tripId/rescue — ranked cash vs points rescue options
export const getRescueOptions = (tripId, body) =>
  req("/trips/" + tripId + "/rescue", {
    method: "POST",
    body: JSON.stringify(body),
  });

// POST /trips/:tripId/rescue/accept — user accepts a rescue option
export const acceptRescue = (tripId, body) =>
  req("/trips/" + tripId + "/rescue/accept", {
    method: "POST",
    body: JSON.stringify(body),
  });

// POST /trips/:tripId/rescue/reject — user declines all rescue options
export const rejectRescue = (tripId, body) =>
  req("/trips/" + tripId + "/rescue/reject", {
    method: "POST",
    body: JSON.stringify(body),
  });

// ─── LEARNING LOOP OUTCOME CAPTURE (v2.2) ────────────────────────────────────
// POST /trips/:tripId/outcome — post-trip rating + predicted vs actual
export const recordTripOutcome = (tripId, body) =>
  req("/trips/" + tripId + "/outcome", {
    method: "POST",
    body: JSON.stringify(body),
  });

// ─── CONCIERGE THREAD PERSISTENCE ────────────────────────────────────────────
export const getConciergeThread = (tripId = null) =>
  req("/concierge/thread" + (tripId ? "?trip_id=" + tripId : ""));

export const saveConciergeThread = (messages, tripId = null) =>
  req("/concierge/thread", {
    method: "POST",
    body: JSON.stringify({ messages, trip_id: tripId }),
  });

// ─── TRIP SHARING ─────────────────────────────────────────────────────────────
export const shareTripLink = (tripId) =>
  req("/trips/" + tripId + "/share", { method: "POST" });

// ─── WINGMAN WRAPPED ──────────────────────────────────────────────────────────
export const getWrapped = (year = new Date().getFullYear()) =>
  req("/insights/wrapped?year=" + year);
// ─── DAY-OF-FLIGHT BRIEFING ───────────────────────────────────────────────────
export const getTripBriefing = (tripId) =>
  req("/trips/" + tripId + "/briefing");
// ─── DESTINATION INTELLIGENCE ─────────────────────────────────────────────────
export const getDestinationIntel = (tripId) =>
  req("/trips/" + tripId + "/destination-intel");
// ─── GROUP TRAVEL / COMPANIONS ────────────────────────────────────────────────
export const inviteCompanion = (tripId, inviteeEmail) =>
  req("/trips/" + tripId + "/companions/invite", {
    method: "POST",
    body: JSON.stringify({ invitee_email: inviteeEmail }),
  });
export const getCompanions = (tripId) =>
  req("/trips/" + tripId + "/companions");
export const acceptCompanionInvite = (token) =>
  req("/companions/accept/" + token, { method: "POST" });
// ─── LOYALTY ACCOUNTS ─────────────────────────────────────────────────────────
export const getLoyaltyAccounts = () => req("/loyalty");
// ─── GROUND TRANSPORT ────────────────────────────────────────────────────────
export const getGroundTransport = (iata, destination = null) =>
  req(`/ground-transport/${encodeURIComponent(iata)}${destination ? `?destination=${encodeURIComponent(destination)}` : ""}`);

