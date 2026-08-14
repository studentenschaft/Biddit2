import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudyondBanner from "../StudyondBanner";
import { ANALYTICS_NOTICE_STORAGE_KEY } from "../AnalyticsNotice";
import {
  ANALYTICS_OPT_OUT_STORAGE_KEY,
  isAnalyticsEnvironment,
} from "../../helpers/analytics";

// The environment gate is false in jsdom, so it is stubbed per test to cover
// both the analytics and the non-analytics deployment.
vi.mock("../../helpers/analytics", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isAnalyticsEnvironment: vi.fn(() => false) };
});

const headline = /find your thesis topic in minutes/i;

/** The banner appears behind a 2s delay plus a 200ms animation tick. */
const runShowDelay = () => act(() => vi.advanceTimersByTime(2500));

describe("StudyondBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    isAnalyticsEnvironment.mockReturnValue(false);
  });

  afterEach(() => vi.useRealTimers());

  it("shows where analytics never runs, so no notice is pending", () => {
    render(<StudyondBanner />);
    runShowDelay();
    expect(screen.getByText(headline)).toBeInTheDocument();
  });

  it("stays away while the analytics notice is still unanswered", () => {
    isAnalyticsEnvironment.mockReturnValue(true);
    render(<StudyondBanner />);
    runShowDelay();
    expect(screen.queryByText(headline)).not.toBeInTheDocument();
  });

  it("shows once the notice has been dismissed", () => {
    isAnalyticsEnvironment.mockReturnValue(true);
    localStorage.setItem(ANALYTICS_NOTICE_STORAGE_KEY, "true");
    render(<StudyondBanner />);
    runShowDelay();
    expect(screen.getByText(headline)).toBeInTheDocument();
  });

  it("shows once the visitor has opted out, which also settles the notice", () => {
    isAnalyticsEnvironment.mockReturnValue(true);
    localStorage.setItem(ANALYTICS_OPT_OUT_STORAGE_KEY, "true");
    render(<StudyondBanner />);
    runShowDelay();
    expect(screen.getByText(headline)).toBeInTheDocument();
  });

  it("still respects its own dismissal", () => {
    localStorage.setItem("studyondBannerDismissedAt", new Date().toISOString());
    render(<StudyondBanner />);
    runShowDelay();
    expect(screen.queryByText(headline)).not.toBeInTheDocument();
  });
});
