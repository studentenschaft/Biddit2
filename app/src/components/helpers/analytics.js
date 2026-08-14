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

let initialized = false;
let enabled = false;
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

/**
 * Initialize GA4 once per page load. Idempotent — later calls are no-ops.
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

  enabled = enabledOverride ?? isAnalyticsEnvironment();
  initialized = true;

  const queued = pendingEvents;
  pendingEvents = [];
  if (!enabled) return;

  ReactGA.initialize(GA_MEASUREMENT_ID, {
    testMode: !import.meta.env.PROD,
    // Pageviews are sent explicitly by trackPageView; the gtag default would
    // double-count the landing view.
    gtagOptions: { send_page_view: false },
  });
  ReactGA.gtag("set", "user_properties", { app_version: APP_VERSION });

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
  pendingEvents = [];
};
