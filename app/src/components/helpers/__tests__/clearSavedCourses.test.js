import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteCourse, getStudyPlan } from "../api";
import {
  CLEAR_LOAD_FAILURE_MESSAGE,
  clearOutcome,
  clearSavedCourses,
} from "../clearSavedCourses";

vi.mock("../api", () => ({
  getStudyPlan: vi.fn(),
  deleteCourse: vi.fn(),
}));

const PLANS = [
  { id: "FS23", courses: ["7,035,1.00", "7,214,1.00"] },
  { id: "HS25", courses: ["11,702,1.00"] },
];

describe("clearSavedCourses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteCourse.mockResolvedValue(true);
  });

  it("deletes courses from every semester, each under its own study plan", async () => {
    getStudyPlan.mockResolvedValue(PLANS);

    await expect(clearSavedCourses("token")).resolves.toEqual({
      total: 3,
      deleted: 3,
    });
    expect(deleteCourse.mock.calls.map(([plan, course]) => [plan, course])).toEqual([
      ["FS23", "7,035,1.00"],
      ["FS23", "7,214,1.00"],
      ["HS25", "11,702,1.00"],
    ]);
  });

  it("does not report a per-course failure, which would stack a toast each time", async () => {
    getStudyPlan.mockResolvedValue(PLANS);

    await clearSavedCourses("token");

    for (const call of deleteCourse.mock.calls) {
      expect(call[3]).toEqual({ reportErrors: false });
    }
  });

  it("keeps going after a rejected course and counts what really went through", async () => {
    getStudyPlan.mockResolvedValue(PLANS);
    deleteCourse.mockResolvedValueOnce(false);

    await expect(clearSavedCourses("token")).resolves.toEqual({
      total: 3,
      deleted: 2,
    });
    expect(deleteCourse).toHaveBeenCalledTimes(3);
  });

  it("ignores plans that hold no courses", async () => {
    getStudyPlan.mockResolvedValue([
      { id: "FS23", courses: [] },
      { id: "HS25", courses: ["11,702,1.00"] },
      { id: null, courses: ["7,035,1.00"] },
      null,
    ]);

    await expect(clearSavedCourses("token")).resolves.toEqual({
      total: 1,
      deleted: 1,
    });
  });
});

describe("clearOutcome", () => {
  it("reports an empty wishlist only when the backend really has none", () => {
    expect(clearOutcome({ total: 0, deleted: 0 })).toEqual({
      message: "No saved courses found to clear.",
      reload: false,
    });
  });

  it("never claims success when nothing was deleted", () => {
    const { message, reload } = clearOutcome({ total: 5, deleted: 0 });

    expect(message).toContain("Could not clear your 5 saved courses");
    expect(message).not.toContain("No saved courses found");
    expect(reload).toBe(false);
  });

  it("never announces a clean sweep for a partial wipe", () => {
    const { message, reload } = clearOutcome({ total: 5, deleted: 3 });

    expect(message).toContain("Cleared 3 of 5");
    expect(reload).toBe(true);
  });

  it("confirms a full wipe", () => {
    const { message, reload } = clearOutcome({ total: 3, deleted: 3 });

    expect(message).toContain("All saved courses have been cleared");
    expect(reload).toBe(true);
  });

  it("cannot produce the empty-wishlist message for a non-empty wishlist", () => {
    // The regression: a failure used to reach the user as "you have none saved".
    for (const deleted of [0, 1, 4, 5]) {
      expect(clearOutcome({ total: 5, deleted }).message).not.toBe(
        "No saved courses found to clear."
      );
    }
    expect(CLEAR_LOAD_FAILURE_MESSAGE).not.toBe("No saved courses found to clear.");
  });
});
