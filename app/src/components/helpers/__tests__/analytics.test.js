import { beforeEach, describe, expect, it, vi } from "vitest";
import ReactGA from "react-ga4";
import {
  ANALYTICS_OPT_OUT_STORAGE_KEY,
  initAnalytics,
  isAnalyticsEnvironment,
  resetAnalyticsForTests,
  setAnalyticsOptOut,
  trackColumnSwitch,
  trackCourseDetailsOpened,
  trackPageView,
  trackSemesterSwitch,
  trackTabSelect,
  trackWishlistChange,
  trackWishlistCleared,
} from "../analytics";

const eventCalls = () => ReactGA.event.mock.calls;

describe("analytics adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAnalyticsForTests();
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  describe("isAnalyticsEnvironment", () => {
    it("only reports from the production host of a production build", () => {
      expect(
        isAnalyticsEnvironment({ isProd: true, hostname: "biddit.app" })
      ).toBe(true);
      // Preview deploys are production builds but must stay out of the property
      expect(
        isAnalyticsEnvironment({ isProd: true, hostname: "dev-biddit.netlify.app" })
      ).toBe(false);
      expect(
        isAnalyticsEnvironment({ isProd: false, hostname: "biddit.app" })
      ).toBe(false);
    });
  });

  describe("initAnalytics", () => {
    it("stays off under the real environment gate outside production", () => {
      // No enabled override: the shipping code path (jsdom = dev + localhost)
      initAnalytics({ initialView: "summary" });
      trackTabSelect("calendar", "summary");

      expect(ReactGA.initialize).not.toHaveBeenCalled();
      expect(ReactGA.event).not.toHaveBeenCalled();
    });

    it("configures GA4 without the gtag pageview and sets the app version", () => {
      initAnalytics({ enabled: true, initialView: "summary" });

      expect(ReactGA.initialize).toHaveBeenCalledTimes(1);
      expect(ReactGA.initialize).toHaveBeenCalledWith(
        "G-BMG2V9ZX73",
        expect.objectContaining({ gtagOptions: { send_page_view: false } })
      );
      expect(ReactGA.initialize.mock.calls[0][1]).not.toHaveProperty("debug");
      expect(ReactGA.gtag).toHaveBeenCalledWith("set", "user_properties", {
        app_version: "v2",
      });
    });

    it("reports the landing tab once as a session-start tab_select", () => {
      initAnalytics({ enabled: true, initialView: "summary" });

      expect(ReactGA.event).toHaveBeenCalledTimes(1);
      expect(ReactGA.event).toHaveBeenCalledWith(
        "tab_select",
        expect.objectContaining({ from: null, to: "summary" })
      );
    });

    it("skips the session-start event when no landing tab is given", () => {
      initAnalytics({ enabled: true });

      expect(ReactGA.event).not.toHaveBeenCalled();
    });

    it("is idempotent", () => {
      initAnalytics({ enabled: true, initialView: "summary" });
      initAnalytics({ enabled: true, initialView: "calendar" });

      expect(ReactGA.initialize).toHaveBeenCalledTimes(1);
      expect(ReactGA.event).toHaveBeenCalledTimes(1);
    });
  });

  describe("when disabled", () => {
    it("neither initializes GA4 nor sends anything", () => {
      initAnalytics({ enabled: false, initialView: "summary" });

      trackPageView("/");
      trackTabSelect("calendar", "summary");
      trackCourseDetailsOpened("course-list");
      trackColumnSwitch(true);
      trackWishlistChange({ action: "add", courseNumber: "1234" });
      trackWishlistCleared(3);
      trackSemesterSwitch("HS25", "FS25");

      expect(ReactGA.initialize).not.toHaveBeenCalled();
      expect(ReactGA.event).not.toHaveBeenCalled();
      expect(ReactGA.gtag).not.toHaveBeenCalled();
    });
  });

  describe("pre-init queue", () => {
    it("flushes queued events first so the landing page_view is the session's first hit", () => {
      trackPageView("/");
      trackColumnSwitch(false);

      expect(ReactGA.event).not.toHaveBeenCalled();

      initAnalytics({ enabled: true, initialView: "summary" });

      expect(eventCalls().map(([name]) => name)).toEqual([
        "page_view",
        "column_switch",
        "tab_select",
      ]);
      expect(eventCalls()[2][1]).toEqual(
        expect.objectContaining({ from: null, to: "summary" })
      );
    });

    it("skips the session-start tab_select when a pre-init tab change already recorded it", () => {
      trackTabSelect("calendar", "summary");

      initAnalytics({ enabled: true, initialView: "calendar" });

      const tabSelects = eventCalls().filter(([name]) => name === "tab_select");
      expect(tabSelects).toHaveLength(1);
      expect(tabSelects[0][1]).toEqual(
        expect.objectContaining({ from: "summary", to: "calendar" })
      );
    });

    it("drops what was queued when analytics turns out to be disabled", () => {
      trackTabSelect("calendar", "summary");
      initAnalytics({ enabled: false });

      expect(ReactGA.event).not.toHaveBeenCalled();
    });
  });

  describe("trackPageView", () => {
    beforeEach(() => {
      initAnalytics({ enabled: true });
    });

    it("never leaks the auth fragment or a query string", () => {
      window.history.replaceState({}, "", "/biddit2?foo=bar#code=abc&state=x");

      trackPageView();

      const [, params] = eventCalls()[0];
      expect(params.page_location).not.toContain("#");
      expect(params.page_location).not.toContain("?");
      expect(params.page_location).toBe(`${window.location.origin}/biddit2`);
    });

    it("reports the given path and the document title", () => {
      document.title = "Biddit";

      trackPageView("/login");

      expect(ReactGA.event).toHaveBeenCalledWith("page_view", {
        page_location: `${window.location.origin}/login`,
        page_title: "Biddit",
      });
    });
  });

  describe("event payloads", () => {
    beforeEach(() => {
      initAnalytics({ enabled: true });
    });

    it("stamps a sanitized page_location on every event", () => {
      window.history.replaceState({}, "", "/biddit2?foo=1#code=abc");

      trackTabSelect("calendar", "summary");

      expect(eventCalls()[0][1].page_location).toBe(
        `${window.location.origin}/biddit2`
      );
    });

    it("maps the visible column to a readable name", () => {
      trackColumnSwitch(true);
      trackColumnSwitch(false);

      expect(eventCalls()[0][1]).toEqual(
        expect.objectContaining({ column: "course_list" })
      );
      expect(eventCalls()[1][1]).toEqual(
        expect.objectContaining({ column: "tabs" })
      );
    });

    it("snake-cases the wishlist payload", () => {
      trackWishlistChange({
        action: "add",
        courseNumber: "1234",
        credits: 4,
        classification: "Core",
        semester: "HS25",
      });

      expect(ReactGA.event).toHaveBeenCalledWith(
        "wishlist_change",
        expect.objectContaining({
          action: "add",
          course_number: "1234",
          credits: 4,
          classification: "Core",
          semester: "HS25",
        })
      );
    });

    it("reports a bulk clear as a single event with a count", () => {
      trackWishlistCleared(3);

      expect(ReactGA.event).toHaveBeenCalledWith(
        "wishlist_cleared",
        expect.objectContaining({ count: 3 })
      );
    });

    it("normalises a missing previous semester to null", () => {
      trackSemesterSwitch("HS25", undefined);

      expect(ReactGA.event).toHaveBeenCalledWith(
        "semester_switch",
        expect.objectContaining({ semester: "HS25", previous_semester: null })
      );
    });

    it("carries the source into course_details_opened", () => {
      trackCourseDetailsOpened("course-list");

      expect(ReactGA.event).toHaveBeenCalledWith(
        "course_details_opened",
        expect.objectContaining({ source: "course-list" })
      );
    });
  });

  describe("consent opt-out", () => {
    const gaDisableFlag = () => window["ga-disable-G-BMG2V9ZX73"];

    it("never loads the tag and drops the queue when opted out before init", () => {
      localStorage.setItem(ANALYTICS_OPT_OUT_STORAGE_KEY, "true");
      trackTabSelect("calendar", "summary");

      initAnalytics({ enabled: true, initialView: "summary" });

      expect(ReactGA.initialize).not.toHaveBeenCalled();
      expect(ReactGA.event).not.toHaveBeenCalled();
    });

    it("stops sending the moment the visitor opts out, without a reload", () => {
      initAnalytics({ enabled: true });

      setAnalyticsOptOut(true);
      trackTabSelect("calendar", "summary");

      expect(ReactGA.event).not.toHaveBeenCalled();
      expect(gaDisableFlag()).toBe(true);
      expect(localStorage.getItem(ANALYTICS_OPT_OUT_STORAGE_KEY)).toBe("true");
    });

    it("resumes sending on opt-in without loading the tag twice", () => {
      initAnalytics({ enabled: true });
      setAnalyticsOptOut(true);

      setAnalyticsOptOut(false);
      trackTabSelect("calendar", "summary");

      expect(ReactGA.event).toHaveBeenCalledTimes(1);
      expect(gaDisableFlag()).toBe(false);
      expect(localStorage.getItem(ANALYTICS_OPT_OUT_STORAGE_KEY)).toBeNull();
      expect(ReactGA.initialize).toHaveBeenCalledTimes(1);
    });

    it("loads the tag late when the visitor opts in after an opted-out init", () => {
      localStorage.setItem(ANALYTICS_OPT_OUT_STORAGE_KEY, "true");
      initAnalytics({ enabled: true });
      expect(ReactGA.initialize).not.toHaveBeenCalled();

      setAnalyticsOptOut(false);
      trackTabSelect("calendar", "summary");

      expect(ReactGA.initialize).toHaveBeenCalledTimes(1);
      expect(ReactGA.event).toHaveBeenCalledTimes(1);
    });

    it("stays silent on opt-in when the environment gate is off", () => {
      initAnalytics({ enabled: false });

      setAnalyticsOptOut(false);
      trackTabSelect("calendar", "summary");

      expect(ReactGA.initialize).not.toHaveBeenCalled();
      expect(ReactGA.event).not.toHaveBeenCalled();
    });

    describe("cross-tab propagation", () => {
      /** A consent change made in another tab of the same origin. */
      const consentChangedElsewhere = (newValue) =>
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: ANALYTICS_OPT_OUT_STORAGE_KEY,
            newValue,
          })
        );

      it("stops sending when another tab opts out", () => {
        initAnalytics({ enabled: true });

        consentChangedElsewhere("true");
        trackTabSelect("calendar", "summary");

        expect(ReactGA.event).not.toHaveBeenCalled();
        expect(gaDisableFlag()).toBe(true);
      });

      it("resumes sending when another tab opts back in", () => {
        localStorage.setItem(ANALYTICS_OPT_OUT_STORAGE_KEY, "true");
        initAnalytics({ enabled: true });

        consentChangedElsewhere(null);
        trackTabSelect("calendar", "summary");

        expect(ReactGA.initialize).toHaveBeenCalledTimes(1);
        expect(ReactGA.event).toHaveBeenCalledTimes(1);
        expect(gaDisableFlag()).toBe(false);
      });

      it("ignores unrelated storage keys", () => {
        initAnalytics({ enabled: true });

        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "studyondBannerDismissedAt",
            newValue: "true",
          })
        );
        trackTabSelect("calendar", "summary");

        expect(ReactGA.event).toHaveBeenCalledTimes(1);
      });
    });
  });
});
