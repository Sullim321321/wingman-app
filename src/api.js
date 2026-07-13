import { API_BASE } from "./config";
export { API_BASE };

let _token = null;
export function setToken(t) { _token = t; }

// Register a callback to be called when the server returns 401 (expired/invalid token)
// App.js / auth.js wires this up so the user is automatically signed out
let _on401 = null;
export function setOn401Handler(fn) { _on401 = fn; }

/**
 * A timeout signal that actually exists on this engine.
 *
 * We were using AbortSignal.timeout(ms). Hermes does not reliably implement it —
 * and when it's missing, calling it throws a TypeError BEFORE fetch is even
 * attempted. No request, no status, no response: the caller just sees an opaque
 * error. In the concierge that surfaced as "That didn't go through", which is
 * indistinguishable from a server failure and sent us hunting the backend while
 * the request was never leaving the phone.
 *
 * AbortController + setTimeout is plain ES and works on every engine.
 */
function timeoutSignal(ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(new Error("timeout")), ms);
  // Don't leak the timer if the request settles first.
  if (c.signal.addEventListener) {
    c.signal.addEventListener("abort", () => clearTimeout(t), { once: true });
  }
  return c.signal;
}

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

async function reqRaw(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (_token) headers.Authorization = "Bearer " + _token;
  let r;
  try {
    r = await fetchWithRetry(API_BASE + path, { ...opts, headers });
  } catch (e) {
    throw new Error("No connection — check your internet and try again.");
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

export async function req(path, opts = {}) {
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
    const err = new Error("Session expired — please sign in again.");
    err.status = 401;
    throw err;
  }
  if (!r.ok) {
    const err = new Error(body.error || "HTTP " + r.status);
    err.status = r.status;
    err.detail = body.detail || null;
    throw err;
  }
  return body;
}

export const requestCode = (email) =>
  req("/auth/request", { method: "POST", body: JSON.stringify({ email }) });

// referralCode is optional and only ever honoured for brand-new accounts. A bad
// code is ignored server-side rather than failing the sign-in.
export const verifyCode = (email, code, referralCode) =>
  req("/auth/verify", {
    method: "POST",
    body: JSON.stringify({ email, code, ...(referralCode ? { referralCode } : {}) }),
  });

// ─── REFERRAL ────────────────────────────────────────────────────────────────
export const getReferral = () => req("/referral");

// ─── LOYALTY ─────────────────────────────────────────────────────────────────
// Insights derived only from what we actually hold — expiring points, status gaps,
// and bookings that may be missing your number. Deliberately NOT earning rates or
// award availability: we don't have that data and won't guess at it.
export const getLoyaltyInsights = () => req("/loyalty/insights");

export const getPrediction = ({ dep = "DEN", arr = "ASE" } = {}) =>
  req("/predict?dep=" + encodeURIComponent(dep) + "&arr=" + encodeURIComponent(arr));

export const registerPushToken = (pushToken) => {
  let timezone = null;
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch {}
  return req("/push-token", { method: "POST", body: JSON.stringify({ pushToken, timezone }) });
};

export const getMe = () => req("/me");
export const getProfile = () => req("/me");
export const updateProfile = (data) =>
  req("/profile", { method: "PATCH", body: JSON.stringify(data) });

// Gmail
export const getGmailConnectUrl = () => req("/auth/gmail/connect");
export const triggerGmailScan = () =>
  req("/auth/gmail/scan", { method: "POST" });
export const rescanInbox = () =>
  req("/auth/gmail/rescan", { method: "POST" });
export const disconnectGmail = () =>
  req("/auth/gmail", { method: "DELETE" });
export const disconnectGmailAccount = (accountId) =>
  req(`/auth/gmail?account_id=${accountId}`, { method: "DELETE" });
export const scanEmailBody = (emailBody, source) =>
  req("/auth/gmail/scan", { method: "POST", body: JSON.stringify({ emailBody, source }) });
export const getSignals = () => req("/signals");
export const triggerGmailImport = () =>
  req("/auth/gmail/import", { method: "POST" });

// Trips
export const getTrips = (opts = {}) => req("/trips" + (opts.all ? "?all=true" : ""));
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
  req("/concierge", {
    method: "POST",
    body: JSON.stringify({
      message, history,
      ...(location ? { location } : {}),
      // ── Send the clock from the DEVICE, not the datacentre ──────────────────
      // The server was building its time context from `new Date()`, and Render runs
      // in UTC. At 6:30am Pacific the model was told it was 13:30 — early afternoon —
      // so it recommended somewhere for dinner. It wasn't confused; it was misinformed.
      //
      // The phone is the only thing here that actually knows what time it is where
      // you are. Nothing downstream should have to infer it.
      now: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      localTime: new Date().toLocaleString(undefined, {
        weekday: "long", hour: "numeric", minute: "2-digit", hour12: true,
      }),
    }),
    signal: timeoutSignal(65000), // 65s — Render cold-start (up to 50s) + Claude latency
  });

// ─── The Brief ────────────────────────────────────────────────────────────────
// "Nothing needs you" as a computed fact: no broken or tight dependency, no unresolved
// must, no inference awaiting your word, no pending decision. Every travel app writes
// that sentence. This one checks it first.
export const getBrief = () => req("/brief");

// ─── Situation (the cascade, as a graph walk) ─────────────────────────────────
// Each node carries a verdict it can defend: broken, at_risk, or unknown. The old
// cascade called everything scheduled after a delay "at risk" without ever checking.
export const getSituation = (legId, delay = 0) => req(`/situation/${legId}?delay=${delay}`);

// Rescue options — ranked by what they PROTECT, not by price. Real Duffel offers only.
// Takes a while: it's a live flight search plus a graph walk per option.
//
// NOT `getRescueOptions` — that name is already taken by the older cash-vs-points
// engine further down this file. I redeclared it and every single screen white-screened,
// because a duplicate export makes the whole module throw at import. Which is the exact
// failure `npm run check` exists to catch, and did.
export const getSituationOptions = (legId, delay = 0) =>
  req(`/situation/${legId}/options?delay=${delay}`, { signal: timeoutSignal(60000) });

// ─── Booking (the plan becomes a commitment) ──────────────────────────────────
// The verb the deck promised and the code never had. Note what these DON'T do: they
// never create a trip. They promote the leg the planner already wrote, in place, so
// it carries its reasons across. A booking that forgot why it exists is a booking the
// cascade can't defend.
//
// 60s: this fans out to every airline behind Duffel.
export const getLegBooking = (legId, cabin) =>
  req(`/plan/leg/${legId}/book${cabin ? `?cabin=${cabin}` : ""}`, { signal: timeoutSignal(60000) });

export const bookLeg = (legId, offerId, by = "you") =>
  req(`/plan/leg/${legId}/book`, {
    method: "POST",
    body: JSON.stringify({ offer_id: offerId, by }),
    signal: timeoutSignal(90000),
  });

// ─── Inbound forwarding (the no-Gmail path) ───────────────────────────────────
// gmail.readonly is a RESTRICTED scope: it triggers a mandatory annual CASA security
// assessment by a Google-approved assessor. Forwarding needs zero Google scopes, and
// with a Gmail auto-forward filter it is just as ambient.
export const getInboundAddress = () => req("/me/inbound-address");

// ─── Plan (the front door) ─────────────────────────────────────────────────────
// A conversation goes in; a constraint graph comes out, with the reason on every
// line. This is the half of the product that never existed — Wingman could file a
// trip, it could never make one.
//
// 90s, not 65s: a planning turn may run a web search before it answers, because
// entry rules and alliance cutoffs must be looked up rather than recalled.
export const planMessage = (message, tripId = null, history = []) =>
  req("/plan/message", {
    method: "POST",
    body: JSON.stringify({ message, tripId, history }),
    signal: timeoutSignal(90000),
  });

export const getPlan = (tripId) => req(`/plan/${tripId}`);

// An inference becomes a fact. The only way that ever happens.
export const confirmConstraint = (id) =>
  req(`/plan/constraint/${id}/confirm`, { method: "POST" });

// ─── Decisions (chief-of-staff decision cards) ─────────────────────────────────
export const getDecisions = () => req("/decisions");
export const confirmDecision = (id, optionId) =>
  req(`/decisions/${id}/confirm`, { method: "POST", body: JSON.stringify(optionId ? { option_id: optionId } : {}) });
export const dismissDecision = (id) =>
  req(`/decisions/${id}/dismiss`, { method: "POST" });
export const undoDecision = (id) =>
  req(`/decisions/${id}/undo`, { method: "POST" });
export const simulateDecision = () =>
  req("/decisions/simulate", { method: "POST" });

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

// Duffel flight search + booking
export const searchAirports = (q) => req(`/airports/search?q=${encodeURIComponent(q)}`);
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

// ─── AUTONOMY POLICY ─────────────────────────────────────────────────────────
// Save user delegation rules — backend is at /policy (not /profile/policy)
export const updatePolicy = (policy) =>
  req("/policy", { method: "PATCH", body: JSON.stringify(policy) });

// Get current policy
export const getPolicy = () => req("/policy");

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

// ── Cascade Actions — real endpoint execution ────────────────────────────────
export const executeCascadeAction = (tripId, action, body = {}) =>
  req(`/trips/${tripId}/cascade/${action}`, {
    method: "POST",
    body: JSON.stringify(body),
  });

// ── Passenger Profile — required for silent autonomy ────────────────────────
export const getPassengerProfile = () =>
  req("/profile/passenger");

export const savePassengerProfile = (body) =>
  req("/profile/passenger", {
    method: "POST",
    body: JSON.stringify(body),
  });

// ── Trip title cleanup — rename Unknown Trip records using existing leg data ──
export const renameUnknownTrips = () =>
  req("/trips/rename-unknown", { method: "POST" });

// ── Cascade Downstream Notifications ─────────────────────────────────────────
export const notifyHotel = (tripId, legId, delayMinutes, hotelPhone) =>
  req(`/trips/${tripId}/cascade/hotel-notify`, {
    method: "POST",
    body: JSON.stringify({ leg_id: legId, delay_minutes: delayMinutes, hotel_phone: hotelPhone }),
  });

export const notifyRestaurant = (tripId, legId, delayMinutes, restaurantPhone) =>
  req(`/trips/${tripId}/cascade/restaurant-reschedule`, {
    method: "POST",
    body: JSON.stringify({ leg_id: legId, delay_minutes: delayMinutes, restaurant_phone: restaurantPhone }),
  });

// ── Briefing data sources ─────────────────────────────────────────────────────
export const getLocalNews = ({ city, country, lat, lng } = {}) => {
  const params = new URLSearchParams();
  if (city)    params.set("city",    city);
  if (country) params.set("country", country);
  if (lat)     params.set("lat",     String(lat));
  if (lng)     params.set("lng",     String(lng));
  return req(`/local-news?${params.toString()}`);
};
export const getLocalTraffic = ({ lat, lng, city } = {}) => {
  const params = new URLSearchParams();
  if (lat)  params.set("lat",  String(lat));
  if (lng)  params.set("lng",  String(lng));
  if (city) params.set("city", city);
  return req(`/local-traffic?${params.toString()}`);
};
export const getTodayEvents = () => req("/today-events");

// ── Briefing time ─────────────────────────────────────────────────────────────
export const updateBriefingTime = (hour) =>
  req("/me/briefing-time", { method: "PATCH", body: JSON.stringify({ briefing_hour: hour }) });


// ── Concierge memory — remembered instructions ────────────────────────────────
export const getInstructions = () => req("/me/instructions");
export const deleteInstruction = (id) =>
  req(`/me/instructions/${encodeURIComponent(id)}`, { method: "DELETE" });

// ── Pre-trip checklist ────────────────────────────────────────────────────────
export const generateChecklist = (tripId) =>
  req(`/trips/${tripId}/checklist/generate`, { method: "POST" });
export const getChecklist = (tripId) =>
  req(`/trips/${tripId}/checklist`);
export const updateChecklistItem = (tripId, itemId, completed) =>
  req(`/trips/${tripId}/checklist/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify({ completed }),
  });
export const addChecklistItem = (tripId, item, category) =>
  req(`/trips/${tripId}/checklist`, {
    method: "POST",
    body: JSON.stringify({ item, category }),
  });

// ── Trip companions metadata ──────────────────────────────────────────────────
export const updateCompanionsMeta = (tripId, companionsCount, companionNames) =>
  req(`/trips/${tripId}/companions/meta`, {
    method: "PATCH",
    body: JSON.stringify({ companions_count: companionsCount, companion_names: companionNames }),
  });

// ── Show nights ───────────────────────────────────────────────────────────────
export const getShowNights = (tripId) =>
  req(`/trips/${tripId}/show-nights`);

// Leg edit / delete / add
export const editLeg = (tripId, legId, updates) =>
  req(`/trips/${tripId}/legs/${legId}`, { method: "PATCH", body: JSON.stringify(updates) });
export const deleteLeg = (tripId, legId) =>
  req(`/trips/${tripId}/legs/${legId}`, { method: "DELETE" });
export const addLeg = (tripId, leg) =>
  req(`/trips/${tripId}/legs`, { method: "POST", body: JSON.stringify(leg) });

// Backfill onboarding recap ("here's what I found")
export const getOnboardingSummary = () => req(`/onboarding/summary`);

// Muted destination photo for trip screens (Unsplash-backed, cached server-side)
export const getDestinationImage = (city) => req(`/destination/image?city=${encodeURIComponent(city || "")}`);

// Dismiss a signal (swipe-to-dismiss on the Signals feed)
export const dismissSignal = (id) => req(`/activity/${id}/dismiss`, { method: "POST" });

// ROI history — value protected per month (Insights trend chart)
export const getInsightsHistory = (months = 12) => req(`/insights/roi/history?months=${months}`);

// Standing orders — per-trip pre-authorized auto-rebooking rules
export const getStandingOrder = (tripId) => req(`/trips/${tripId}/standing-order`);
export const setStandingOrder = (tripId, order) =>
  req(`/trips/${tripId}/standing-order`, { method: "PUT", body: JSON.stringify(order) });

// Itinerary paste import
export const importPasteItinerary = (text, companions_count, companion_names) =>
  req("/trips/import/paste", { method: "POST", body: JSON.stringify({ text, companions_count, companion_names }) });

// Saved hotel/flight options
export const saveOption = (tripId, option) =>
  req(`/trips/${tripId}/saved-options`, { method: "POST", body: JSON.stringify({ option }) });
export const getSavedOptions = (tripId) =>
  req(`/trips/${tripId}/saved-options`);

// Calendar export — fetches the .ics with auth and returns raw text
export const exportCalendarIcs = (tripId) =>
  reqRaw(`/trips/${tripId}/calendar.ics`);

// Offline snapshot
export const getOfflineSnapshot = () => req("/me/offline-snapshot");

// ─── TRIPIT iCAL SYNC ─────────────────────────────────────────────────────────
export const syncTripItIcal = (ical_url) =>
  req("/integrations/tripit/sync", { method: "POST", body: JSON.stringify({ ical_url }) });
export const getTripItStatus = () => req("/integrations/tripit/status");
export const disconnectTripIt = () => req("/integrations/tripit", { method: "DELETE" });

// ─── TRAVELPERK OAUTH SYNC ────────────────────────────────────────────────────
export const getTravelPerkConnectUrl = () => req("/integrations/travelperk/connect");
export const syncTravelPerk = () => req("/integrations/travelperk/sync", { method: "POST" });
export const getTravelPerkStatus = () => req("/integrations/travelperk/status");
export const disconnectTravelPerk = () => req("/integrations/travelperk", { method: "DELETE" });

// ─── PDF OCR IMPORT ───────────────────────────────────────────────────────────
// Uploads a PDF or image file and extracts booking data using Claude vision
export const importPdfOcr = async (fileUri, mimeType = "application/pdf") => {
  const headers = {};
  if (_token) headers.Authorization = "Bearer " + _token;
  const formData = new FormData();
  formData.append("pdf", { uri: fileUri, type: mimeType, name: "booking.pdf" });
  let r;
  try {
    r = await fetchWithRetry(API_BASE + "/trips/import/pdf-ocr", {
      method: "POST",
      headers,
      body: formData,
      signal: timeoutSignal(60000),
    });
  } catch (e) {
    throw new Error("No connection — check your internet and try again.");
  }
  const text = await r.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!r.ok) throw Object.assign(new Error(body.error || `HTTP ${r.status}`), { status: r.status, body });
  return body;
};

// ─── TRAVEL STATS ─────────────────────────────────────────────────────────────
export const getTravelStats = () => req("/me/stats");

// ─── USER MEMORY ──────────────────────────────────────────────────────────────
export const getMemory         = ()       => req("/me/memory");
export const updateMemory      = (fields) => req("/me/memory", { method: "PATCH", body: JSON.stringify(fields) });
export const deleteMemoryField = (field)  => req(`/me/memory/${encodeURIComponent(field)}`, { method: "DELETE" });
