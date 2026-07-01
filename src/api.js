import { API_BASE } from "./config";
export { API_BASE };

let _token = null;
export function setToken(t) { _token = t; }

// Register a callback to be called when the server returns 401 (expired/invalid token)
// App.js / auth.js wires this up so the user is automatically signed out
let _on401 = null;
export function setOn401Handler(fn) { _on401 = fn; }

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
  if (r.status === 401) {
    // Token expired or invalid — trigger auto sign-out if handler is registered
    if (_on401) _on401();
    throw new Error("Session expired — please sign in again.");
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
export const disconnectGmail = () =>
  req("/auth/gmail", { method: "DELETE" });

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
// Public variant — no auth required, used by home screen tracker for new users
export const getFlightStatusPublic = (ident) =>
  fetch(`${API_BASE}/flight-status-public?ident=${encodeURIComponent(ident)}`)
    .then(r => r.json())
    .catch(() => ({ ident, status: "Unknown", live: false }));
export const getFlightStatus = (ident) =>
  req("/flight-status/" + encodeURIComponent(ident));
export const getNextTripWindow = () => req("/me/next-trip-window");
// ─── Wingman Points ───────────────────────────────────────────────────────────
export const getPoints = () => req("/points");
export const awardPointsAction = (action, dedup_key) =>
  req("/points/award", { method: "POST", body: JSON.stringify({ action, dedup_key }) });
export const redeemPoints = (perk_id) =>
  req("/points/redeem", { method: "POST", body: JSON.stringify({ perk_id }) });
export const getDestinationIntel = ({ iata, city, trip_id } = {}) => {
  const params = new URLSearchParams();
  if (iata)    params.set("iata", iata);
  if (city)    params.set("city", city);
  if (trip_id) params.set("trip_id", trip_id);
  return req("/destination/intel?" + params.toString());
};
export const refreshTrip = (id) =>
  req("/trips/" + id + "/refresh", { method: "POST" });

// Weather widget
export const getWeather = (lat, lng) =>
  req(`/weather?lat=${lat}&lng=${lng}`);

// Concierge
export const sendConciergeMessage = (message, history = [], location = null) =>
  req("/concierge", { method: "POST", body: JSON.stringify({ message, history, ...(location ? { location } : {}) }) });

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
export const clearConciergeThread = (tripId = null) =>
  req("/concierge/thread" + (tripId ? "?trip_id=" + tripId : ""), { method: "DELETE" });

// ─── TRIP SHARING ─────────────────────────────────────────────────────────────
export const shareTripLink = (tripId) =>
  req("/trips/" + tripId + "/share", { method: "POST" });

// ─── WINGMAN WRAPPED ──────────────────────────────────────────────────────────
export const getWrapped = (year = new Date().getFullYear()) =>
  req("/insights/wrapped?year=" + year);
// ─── DAY-OF-FLIGHT BRIEFING ───────────────────────────────────────────────────
export const getTripBriefing = (tripId) =>
  req("/trips/" + tripId + "/briefing");
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
export const connectLoyaltyAccount = (program, fields) =>
  req("/loyalty/connect", { method: "POST", body: JSON.stringify({ program, ...fields }) });
export const updateLoyaltyAccount = (program, fields) =>
  req("/loyalty/" + program, { method: "PATCH", body: JSON.stringify(fields) });
export const removeLoyaltyAccount = (program) =>
  req("/loyalty/" + program, { method: "DELETE" });
// ─── GROUND TRANSPORT ────────────────────────────────────────────────────────
export const getGroundTransport = (iata, destination = null) =>
  req(`/ground-transport/${encodeURIComponent(iata)}${destination ? `?destination=${encodeURIComponent(destination)}` : ""}`);

// ─── HOTEL AFFINITY (revealed preferences) ───────────────────────────────────
export const getHotelAffinity = () => req("/me/hotel-affinity");
export const removeHotelAffinity = (propertyName) =>
  req(`/me/hotel-affinity/${encodeURIComponent(propertyName)}`, { method: "DELETE" });
// ─── APPLE + SMS AUTH ─────────────────────────────────────────────────────────
export const signInWithAppleToken = (identityToken, email, fullName) =>
  req("/auth/apple", {
    method: "POST",
    body: JSON.stringify({ identityToken, email, fullName }),
  });
export const requestSmsCode = (phone) =>
  req("/auth/sms/request", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
export const verifySmsCode = (phone, code) =>
  req("/auth/sms/verify", {
    method: "POST",
    body: JSON.stringify({ phone, code }),
  });
// ─── AIRPORT INTELLIGENCE ─────────────────────────────────────────────────────
export const getAirportDining = (iata, terminal = null) =>
  req(`/airports/${encodeURIComponent(iata)}/dining${terminal ? `?terminal=${encodeURIComponent(terminal)}` : ""}`);
export const getAirportNavigation = (iata, gate = null) =>
  req(`/airports/${encodeURIComponent(iata)}/navigate${gate ? `?gate=${encodeURIComponent(gate)}` : ""}`);
export const getCityTransport = (iata) =>
  req(`/airports/${encodeURIComponent(iata)}/city-transport`);

// ── Travel Profile ──────────────────────────────────────────────────────────
export const getTravelProfile = () => req("/me/travel-profile");
export const updateTravelProfile = (data) =>
  req("/me/travel-profile", { method: "PATCH", body: JSON.stringify(data) });

// ── Home State (contextual) ─────────────────────────────────────────────────
export const getHomeState = (lat, lng) => {
  const params = lat && lng ? `?lat=${lat}&lng=${lng}` : "";
  return req("/me/home-state" + params);
};

// ── Journey Simulation ──────────────────────────────────────────────────────
export const simulateJourney = (tripId, legId, lat, lng) => {
  const params = new URLSearchParams({ tripId, legId });
  if (lat) params.set("lat", lat);
  if (lng) params.set("lng", lng);
  return req("/journey/simulate?" + params.toString());
};

// ── Disruption Alternatives ─────────────────────────────────────────────────
export const getDisruptionAlternatives = (tripId, legId) =>
  req(`/disruption/alternatives?tripId=${tripId}&legId=${legId}`);

// ── Transit Check ───────────────────────────────────────────────────────────
export const checkTransitPayment = (city, lat, lng) =>
  req("/journey/transit-check", { method: "POST", body: JSON.stringify({ city, lat, lng }) });
