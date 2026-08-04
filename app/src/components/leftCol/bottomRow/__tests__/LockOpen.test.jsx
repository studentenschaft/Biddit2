/**
 * Tests for LockOpen's degraded-mode gate. Mocks `useDegradedMode` directly
 * (same pattern as DegradedModeBanner.test.jsx) and `useCourseSelection` so
 * the test doesn't need to stand up the full wishlist Recoil graph — only
 * the toggle handler and disabled styling are under test here.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { RecoilRoot } from "recoil";
import LockOpen from "../LockOpen";
import { useDegradedMode } from "../../../common/useDegradedMode";

vi.mock("../../../common/useDegradedMode", () => ({
  useDegradedMode: vi.fn(),
}));

const addOrRemoveCourseMock = vi.fn();
vi.mock("../../../helpers/useCourseSelection", () => ({
  useCourseSelection: () => ({ addOrRemoveCourse: addOrRemoveCourseMock }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const event = { courseNumber: "1234", selected: false, enrolled: false };

const renderLockOpen = () =>
  render(
    <RecoilRoot>
      <LockOpen clg="w-4 h-4" event={event} />
    </RecoilRoot>
  );

describe("LockOpen", () => {
  describe("normal mode", () => {
    it("toggles the course on mousedown", () => {
      useDegradedMode.mockReturnValue({ isDegradedMode: false, message: null });

      const { container } = renderLockOpen();
      const svg = container.querySelector("svg");

      fireEvent.mouseDown(svg);

      expect(addOrRemoveCourseMock).toHaveBeenCalledWith(event);
    });

    it("has no degraded tooltip or disabled styling", () => {
      useDegradedMode.mockReturnValue({ isDegradedMode: false, message: null });

      const { container } = renderLockOpen();
      const svg = container.querySelector("svg");

      expect(svg).not.toHaveAttribute("title");
      expect(svg.getAttribute("class")).not.toContain("cursor-not-allowed");
    });
  });

  describe("degraded mode", () => {
    it("no-ops the click handler", () => {
      useDegradedMode.mockReturnValue({ isDegradedMode: true, message: null });

      const { container } = renderLockOpen();
      const svg = container.querySelector("svg");

      fireEvent.mouseDown(svg);

      expect(addOrRemoveCourseMock).not.toHaveBeenCalled();
    });

    it("renders disabled styling and a tooltip", () => {
      useDegradedMode.mockReturnValue({ isDegradedMode: true, message: null });

      const { container } = renderLockOpen();
      const svg = container.querySelector("svg");

      expect(svg).toHaveAttribute(
        "title",
        "Wishlist temporarily unavailable — back soon"
      );
      expect(svg.getAttribute("class")).toContain("cursor-not-allowed");
    });
  });
});
