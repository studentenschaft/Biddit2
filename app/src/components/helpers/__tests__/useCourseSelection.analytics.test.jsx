/**
 * The wishlist event is the one that carries product meaning (which course, how
 * many credits, which semester), so it is emitted from the shared hook rather
 * than from each of the buttons that call it. These tests pin the payload and
 * the add/remove direction, and that a signed-out user reports nothing.
 */

import { act, renderHook } from "@testing-library/react";
import { RecoilRoot } from "recoil";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { trackWishlistChange } from "../analytics";
import { useCourseSelection } from "../useCourseSelection";

vi.mock("../analytics", () => ({
  trackWishlistChange: vi.fn(),
}));

vi.mock("../api", () => ({
  saveCourse: vi.fn().mockResolvedValue({}),
  deleteCourse: vi.fn().mockResolvedValue({}),
}));

const COURSE = {
  id: "course-1",
  shortName: "Advanced Cybersecurity",
  courseNumber: "7,214,1.00",
  classification: "Core Elective",
  credits: 400, // API format: hundredths of an ECTS
  semester: "HS25",
};

const wrapper = ({ children }) => <RecoilRoot>{children}</RecoilRoot>;

const renderSelection = ({ selectedCourseIds = [], authToken = "token" } = {}) =>
  renderHook(
    () =>
      useCourseSelection({
        selectedCourseIds,
        selectedSemesterShortName: "HS25",
        index: 0,
        authToken,
      }),
    { wrapper }
  );

describe("useCourseSelection wishlist telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports an add with normalized credits", async () => {
    const { result } = renderSelection();

    await act(async () => {
      await result.current.addOrRemoveCourse(COURSE);
    });

    expect(trackWishlistChange).toHaveBeenCalledTimes(1);
    expect(trackWishlistChange).toHaveBeenCalledWith({
      action: "add",
      courseNumber: "7,214,1.00",
      credits: 4,
      classification: "Core Elective",
      semester: "HS25",
    });
  });

  it("reports a remove when the course is already wishlisted", async () => {
    const { result } = renderSelection({ selectedCourseIds: [COURSE.id] });

    await act(async () => {
      await result.current.addOrRemoveCourse(COURSE);
    });

    expect(trackWishlistChange).toHaveBeenCalledWith(
      expect.objectContaining({ action: "remove", courseNumber: "7,214,1.00" })
    );
  });

  it("reports nothing without an auth token", async () => {
    const { result } = renderSelection({ authToken: null });

    await act(async () => {
      await result.current.addOrRemoveCourse(COURSE);
    });

    expect(trackWishlistChange).not.toHaveBeenCalled();
  });
});
