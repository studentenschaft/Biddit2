// LockOpen is both a self-contained toggle (course list) and a plain icon inside
// someone else's button (Transcript). Both roles are pinned here, along with the
// degraded-mode gate. `useDegradedMode` and `useCourseSelection` are mocked so
// the test doesn't need to stand up the full wishlist Recoil graph.

import { fireEvent, render, screen } from "@testing-library/react";
import { RecoilRoot } from "recoil";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LockOpen from "../LockOpen";
import { useDegradedMode } from "../../../common/useDegradedMode";

const addOrRemoveCourse = vi.fn();

vi.mock("../../../common/useDegradedMode", () => ({
  useDegradedMode: vi.fn(),
}));

vi.mock("../../../helpers/useCourseSelection", () => ({
  useCourseSelection: () => ({ addOrRemoveCourse }),
}));

const COURSE = {
  id: "course-1",
  shortName: "Skills: Werteorientiertes Fundraising",
  courseNumber: "7,035,1.00",
  semester: "FS23",
};

const renderInButton = (props) => {
  const onParentClick = vi.fn();
  render(
    <RecoilRoot>
      <button onClick={onParentClick} data-testid="row-button">
        <LockOpen clg="w-4 h-4" {...props} />
      </button>
    </RecoilRoot>
  );
  return { onParentClick, lock: screen.getByTestId("row-button").querySelector("svg") };
};

describe("LockOpen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDegradedMode.mockReturnValue({ isDegradedMode: false, message: null });
  });

  describe("as a plain icon (no event prop)", () => {
    it("lets the click reach the wrapping button", () => {
      const { onParentClick, lock } = renderInButton();

      fireEvent.click(lock);

      expect(onParentClick).toHaveBeenCalledTimes(1);
    });

    it("does not toggle anything itself", () => {
      const { lock } = renderInButton();

      fireEvent.click(lock);

      expect(addOrRemoveCourse).not.toHaveBeenCalled();
    });
  });

  describe("as a self-contained toggle (event prop)", () => {
    it("toggles the course", () => {
      const { lock } = renderInButton({ event: COURSE });

      fireEvent.click(lock);

      expect(addOrRemoveCourse).toHaveBeenCalledWith(COURSE);
    });

    it("stops the click so a parent handler cannot remove the course twice", () => {
      const { onParentClick, lock } = renderInButton({ event: COURSE });

      fireEvent.click(lock);

      expect(onParentClick).not.toHaveBeenCalled();
    });

    it("ignores enrolled courses, which the user may not unassign", () => {
      const { onParentClick, lock } = renderInButton({
        event: { ...COURSE, enrolled: true },
      });

      fireEvent.click(lock);

      expect(addOrRemoveCourse).not.toHaveBeenCalled();
      expect(onParentClick).not.toHaveBeenCalled();
    });

    it("has no degraded tooltip or disabled styling", () => {
      const { lock } = renderInButton({ event: COURSE });

      expect(lock).not.toHaveAttribute("title");
      expect(lock.getAttribute("class")).not.toContain("cursor-not-allowed");
    });
  });

  describe("degraded mode", () => {
    beforeEach(() => {
      useDegradedMode.mockReturnValue({ isDegradedMode: true, message: null });
    });

    it("no-ops the click handler", () => {
      const { lock } = renderInButton({ event: COURSE });

      fireEvent.click(lock);

      expect(addOrRemoveCourse).not.toHaveBeenCalled();
    });

    it("keeps the click from a wrapping button that would toggle the course", () => {
      const { onParentClick, lock } = renderInButton();

      fireEvent.click(lock);

      expect(onParentClick).not.toHaveBeenCalled();
    });

    it("renders disabled styling and a tooltip", () => {
      const { lock } = renderInButton({ event: COURSE });

      expect(lock).toHaveAttribute(
        "title",
        "Wishlist temporarily unavailable — back soon"
      );
      expect(lock.getAttribute("class")).toContain("cursor-not-allowed");
    });
  });
});
