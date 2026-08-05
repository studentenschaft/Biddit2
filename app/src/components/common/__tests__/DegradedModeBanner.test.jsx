/**
 * Tests for DegradedModeBanner. Mocks the `useDegradedMode` hook directly so
 * each test can drive the banner's on/off/message state without touching
 * the underlying fetch-polling service.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import DegradedModeBanner from "../DegradedModeBanner";
import { useDegradedMode } from "../useDegradedMode";

vi.mock("../useDegradedMode", () => ({
  useDegradedMode: vi.fn(),
}));

// jsdom has no ResizeObserver; the banner uses one to publish its own
// height as --degraded-banner-height so page layouts can offset below it
// (see DegradedModeBanner.jsx) instead of overlaying app content.
let resizeObserverInstances = [];

class MockResizeObserver {
  constructor(cb) {
    this.callback = cb;
    resizeObserverInstances.push(this);
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

const HEIGHT_CSS_VAR = "--degraded-banner-height";

beforeEach(() => {
  resizeObserverInstances = [];
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
  document.documentElement.style.removeProperty(HEIGHT_CSS_VAR);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  document.documentElement.style.removeProperty(HEIGHT_CSS_VAR);
});

describe("DegradedModeBanner", () => {
  it("renders nothing when degraded mode is off", () => {
    useDegradedMode.mockReturnValue({ isDegradedMode: false, message: null });

    const { container } = render(<DegradedModeBanner />);

    expect(container).toBeEmptyDOMElement();
  });

  it("resets the height CSS var to 0px when degraded mode is off", () => {
    useDegradedMode.mockReturnValue({ isDegradedMode: false, message: null });

    render(<DegradedModeBanner />);

    expect(
      document.documentElement.style.getPropertyValue(HEIGHT_CSS_VAR),
    ).toBe("0px");
  });

  it("shows the default copy when on with no custom message", () => {
    useDegradedMode.mockReturnValue({ isDegradedMode: true, message: null });

    render(<DegradedModeBanner />);

    expect(
      screen.getByText(/temporarily reduced due to high demand/i),
    ).toBeInTheDocument();
  });

  it("shows a custom message when provided by the service", () => {
    useDegradedMode.mockReturnValue({
      isDegradedMode: true,
      message: "Custom banner text from app-status.json",
    });

    render(<DegradedModeBanner />);

    expect(
      screen.getByText("Custom banner text from app-status.json"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/temporarily reduced due to high demand/i),
    ).not.toBeInTheDocument();
  });

  it("collapses (renders null, not just hidden) when the close button is clicked", () => {
    useDegradedMode.mockReturnValue({ isDegradedMode: true, message: null });

    const { container } = render(<DegradedModeBanner />);
    expect(screen.getByRole("button", { name: /close banner/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /close banner/i }));

    expect(container).toBeEmptyDOMElement();
  });

  it("publishes its rendered height as --degraded-banner-height while visible", () => {
    useDegradedMode.mockReturnValue({ isDegradedMode: true, message: null });

    const { container } = render(<DegradedModeBanner />);
    const bannerNode = container.firstChild;
    Object.defineProperty(bannerNode, "offsetHeight", {
      value: 56,
      configurable: true,
    });

    // The effect observes the node via ResizeObserver; fire the mocked
    // callback the way a real layout pass would.
    resizeObserverInstances.forEach((obs) => obs.callback());

    expect(
      document.documentElement.style.getPropertyValue(HEIGHT_CSS_VAR),
    ).toBe("56px");
  });

  it("resets --degraded-banner-height to 0px on collapse, so the layout offset doesn't stick", () => {
    useDegradedMode.mockReturnValue({ isDegradedMode: true, message: null });

    render(<DegradedModeBanner />);
    fireEvent.click(screen.getByRole("button", { name: /close banner/i }));

    expect(
      document.documentElement.style.getPropertyValue(HEIGHT_CSS_VAR),
    ).toBe("0px");
  });
});
