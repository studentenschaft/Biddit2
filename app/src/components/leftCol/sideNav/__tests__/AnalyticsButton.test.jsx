import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import AnalyticsButton from "../AnalyticsButton";
import {
  ANALYTICS_OPT_OUT_STORAGE_KEY,
  resetAnalyticsForTests,
} from "../../../helpers/analytics";

const GA_DISABLE_KEY = "ga-disable-G-BMG2V9ZX73";

const openDialog = () => {
  const result = render(<AnalyticsButton />);
  fireEvent.click(screen.getByRole("button", { name: "Analytics settings" }));
  return result;
};

const toggle = () => screen.getByRole("switch", { name: /enable analytics/i });

describe("AnalyticsButton", () => {
  beforeEach(() => {
    localStorage.clear();
    resetAnalyticsForTests();
  });
  afterEach(() => resetAnalyticsForTests());

  it("opens the settings dialog from the side-nav trigger", () => {
    render(<AnalyticsButton />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Analytics settings" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("reflects the stored opt-out as an off switch", () => {
    localStorage.setItem(ANALYTICS_OPT_OUT_STORAGE_KEY, "true");
    openDialog();
    expect(toggle()).toHaveAttribute("aria-checked", "false");
  });

  it("shows analytics as on when no opt-out is stored", () => {
    openDialog();
    expect(toggle()).toHaveAttribute("aria-checked", "true");
  });

  it("switching off records the opt-out and disables the loaded tag", () => {
    openDialog();
    fireEvent.click(toggle());

    expect(localStorage.getItem(ANALYTICS_OPT_OUT_STORAGE_KEY)).toBe("true");
    expect(window[GA_DISABLE_KEY]).toBe(true);
    expect(toggle()).toHaveAttribute("aria-checked", "false");
  });

  it("switching back on clears the stored opt-out", () => {
    localStorage.setItem(ANALYTICS_OPT_OUT_STORAGE_KEY, "true");
    openDialog();
    fireEvent.click(toggle());

    expect(localStorage.getItem(ANALYTICS_OPT_OUT_STORAGE_KEY)).toBeNull();
    expect(toggle()).toHaveAttribute("aria-checked", "true");
  });

  it("points at the privacy policy for the full details", () => {
    openDialog();
    expect(
      screen.getByText(
        /full details: privacy \(shield icon\) in the side bar/i,
      ),
    ).toBeInTheDocument();
  });
});
