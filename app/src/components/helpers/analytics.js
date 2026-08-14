import ReactGA from "react-ga4";

/**
 * Single adapter between the app and GA4 — the only module that imports
 * react-ga4. Call sites emit intent (trackTabSelect, trackWishlistChange, …)
 * and never touch gtag or the measurement id.
 *
 * See docs/adr/0003-ga4-analytics-adapter.md.
 */

// Public per GA4 design (it ships in the client bundle), so it stays a constant.
const GA_MEASUREMENT_ID = "G-BMG2V9ZX73";
const APP_VERSION = "v2";
const PRODUCTION_HOSTNAME = "biddit.app";

export const ANALYTICS_OPT_OUT_STORAGE_KEY = "biddit-analytics-opt-out";
const GA_DISABLE_WINDOW_KEY = `ga-disable-${GA_MEASUREMENT_ID}`;

let initialized = false;
let enabled = false; // env gate AND consent — checked per event in emit()
let environmentEnabled = false; // env gate alone, remembered so opt-in can re-enable
let gaLoaded = false; // ReactGA.initialize ran this page load
let pendingEvents = [];

/**
 * Analytics only reports from the production host. Preview deployments
 * (dev-biddit.netlify.app) are production *builds*, so the PROD flag alone
 * is not enough.
 * @param {{isProd?: boolean, hostname?: string}} [env] Injectable for tests
 */
export const isAnalyticsEnvironment = ({
  isProd = import.meta.env.PROD,
  hostname = window.location.hostname,
} = {}) => isProd && hostname === PRODUCTION_HOSTNAME;

// Every hit carries a page_location rebuilt from origin + pathname, so a
// query string or auth fragment can never reach GA on any event.
const sanitizedLocation = () =>
  window.location.origin + window.location.pathname;

const send = ([name, params]) =>
  ReactGA.event(name, { page_location: sanitizedLocation(), ...params });

// Events before initAnalytics are queued (react-ga4 silently drops pre-init
// events) and either flushed in call order (enabled) or dropped (disabled).
const emit = (name, params) => {
  if (!initialized) {
    pendingEvents.push([name, params]);
  } else if (enabled) {
    send([name, params]);
  }
};

// Loads the gtag script. Guarded so a late opt-in cannot load the tag twice.
const loadGa = () => {
  if (gaLoaded) return;
  gaLoaded = true;

  ReactGA.initialize(GA_MEASUREMENT_ID, {
    testMode: !import.meta.env.PROD,
    // Pageviews are sent explicitly by trackPageView; the gtag default would
    // double-count the landing view.
    gtagOptions: { send_page_view: false },
  });
  ReactGA.gtag("set", "user_properties", { app_version: APP_VERSION });
};

/** Consent state, read from localStorage. Safe pre-init. */
export const isAnalyticsOptedOut = () =>
  localStorage.getItem(ANALYTICS_OPT_OUT_STORAGE_KEY) === "true";

/**
 * Apply a consent decision to this tab, both directions, no reload: opting out
 * flips the per-event gate and sets Google's documented window["ga-disable-<id>"]
 * kill switch for the already-loaded tag; opting back in re-enables and (if init
 * ran while opted out) loads the tag now. Does not touch localStorage — the
 * caller owns persistence.
 */
const applyConsent = (optedOut) => {
  if (optedOut) {
    window[GA_DISABLE_WINDOW_KEY] = true;
    enabled = false;
    return;
  }

  window[GA_DISABLE_WINDOW_KEY] = false;
  if (initialized && environmentEnabled) {
    loadGa();
    enabled = true;
  }
};

/** Persist consent and apply it to this tab immediately. */
export const setAnalyticsOptOut = (optedOut) => {
  if (optedOut) {
    localStorage.setItem(ANALYTICS_OPT_OUT_STORAGE_KEY, "true");
  } else {
    localStorage.removeItem(ANALYTICS_OPT_OUT_STORAGE_KEY);
  }
  applyConsent(optedOut);
};

// A choice made in another tab writes the same key; `storage` fires only in the
// other tabs, so this re-applies it here without writing storage back.
window.addEventListener("storage", (event) => {
  if (event.key === ANALYTICS_OPT_OUT_STORAGE_KEY) {
    applyConsent(event.newValue === "true");
  }
});

/**
 * Initialize GA4 once per page load. Idempotent — later calls are no-ops.
 * A stored opt-out wins over the environment gate, so the tag is not loaded
 * at all for an opted-out visitor.
 * `enabled` overrides the environment gate (tests); `initialView` is the tab
 * the session landed on. Queued events flush first so the landing page_view
 * is the session's first hit; the session-start tab_select follows, skipped
 * when a pre-init tab change already recorded the landing tab.
 */
export const initAnalytics = ({
  initialView,
  enabled: enabledOverride,
} = {}) => {
  if (initialized) return;

  environmentEnabled = enabledOverride ?? isAnalyticsEnvironment();
  enabled = environmentEnabled && !isAnalyticsOptedOut();
  initialized = true;

  const queued = pendingEvents;
  pendingEvents = [];
  if (!enabled) return;

  loadGa();
  queued.forEach(send);
  if (initialView && !queued.some(([name]) => name === "tab_select")) {
    trackTabSelect(initialView, null);
  }
};

export const trackPageView = (pathname = window.location.pathname) =>
  emit("page_view", {
    page_location: window.location.origin + pathname,
    page_title: document.title,
  });

export const trackTabSelect = (to, from) =>
  emit("tab_select", { from: from ?? null, to });

export const trackCourseDetailsOpened = (source) =>
  emit("course_details_opened", { source });

export const trackColumnSwitch = (isLeftVisible) =>
  emit("column_switch", { column: isLeftVisible ? "course_list" : "tabs" });

export const trackWishlistChange = ({
  action,
  courseNumber,
  credits,
  classification,
  semester,
}) =>
  emit("wishlist_change", {
    action,
    course_number: courseNumber,
    credits,
    classification,
    semester,
  });

export const trackWishlistCleared = (count) =>
  emit("wishlist_cleared", { count });

export const trackSemesterSwitch = (semester, previousSemester) =>
  emit("semester_switch", {
    semester,
    previous_semester: previousSemester ?? null,
  });

/** Test-only: restores the module to its pre-init state. */
export const resetAnalyticsForTests = () => {
  initialized = false;
  enabled = false;
  environmentEnabled = false;
  gaLoaded = false;
  pendingEvents = [];
  delete window[GA_DISABLE_WINDOW_KEY];
};
