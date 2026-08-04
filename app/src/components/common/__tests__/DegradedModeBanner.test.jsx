/**
 * Tests for DegradedModeBanner. Mocks the `useDegradedMode` hook directly so
 * each test can drive the banner's on/off/message state without touching
 * the underlying fetch-polling service.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import DegradedModeBanner from "../DegradedModeBanner";
import { useDegradedMode } from "../useDegradedMode";

vi.mock("../useDegradedMode", () => ({
  useDegradedMode: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("DegradedModeBanner", () => {
  it("renders nothing when degraded mode is off", () => {
    useDegradedMode.mockReturnValue({ isDegradedMode: false, message: null });

    const { container } = render(<DegradedModeBanner />);

    expect(container).toBeEmptyDOMElement();
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
});
