/**
 * useCurriculumPlan.test.jsx
 * Unit tests for the curriculum plan hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { RecoilRoot } from "recoil";

// Helper for semester comparison (extracted from the hook logic)
const compareSemesters = (a, b) => {
  const parseKey = (key) => {
    const type = key.substring(0, 2);
    const year = parseInt(key.substring(2), 10);
    const fullYear = year < 50 ? 2000 + year : 1900 + year;
    return { type, year, fullYear };
  };
  const parsedA = parseKey(a);
  const parsedB = parseKey(b);
  if (parsedA.fullYear !== parsedB.fullYear)
    return parsedA.fullYear - parsedB.fullYear;
  if (parsedA.type !== parsedB.type) return parsedA.type === "FS" ? -1 : 1;
  return 0;
};

/**
 * Tests for the core utility logic used by useCurriculumPlan
 * These test the pure functions without Recoil state
 */
describe("useCurriculumPlan utilities", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getCurrentSemesterKey logic", () => {
    const getCurrentSemesterKey = () => {
      const now = new Date();
      const currentYear = now.getFullYear() % 100;
      const currentMonth = now.getMonth();
      const isCurrentlyHS = currentMonth >= 8 || currentMonth <= 1;
      const currentSemYear =
        isCurrentlyHS && currentMonth <= 1 ? currentYear - 1 : currentYear;
      return `${isCurrentlyHS ? "HS" : "FS"}${currentSemYear}`;
    };

    it("returns correct semester key for spring semester (March)", () => {
      vi.setSystemTime(new Date("2026-03-15"));
      expect(getCurrentSemesterKey()).toBe("FS26");
    });

    it("returns correct semester key for spring semester (June)", () => {
      vi.setSystemTime(new Date("2026-06-15"));
      expect(getCurrentSemesterKey()).toBe("FS26");
    });

    it("returns correct semester key for fall semester (September)", () => {
      vi.setSystemTime(new Date("2025-09-15"));
      expect(getCurrentSemesterKey()).toBe("HS25");
    });

    it("returns correct semester key for fall semester (November)", () => {
      vi.setSystemTime(new Date("2025-11-15"));
      expect(getCurrentSemesterKey()).toBe("HS25");
    });

    it("handles January correctly (still previous HS)", () => {
      vi.setSystemTime(new Date("2026-01-15"));
      expect(getCurrentSemesterKey()).toBe("HS25");
    });

    it("handles February correctly (still HS as it overlaps)", () => {
      // HSG: HS runs Sept-Feb, so February is still HS
      vi.setSystemTime(new Date("2026-02-15"));
      expect(getCurrentSemesterKey()).toBe("HS25");
    });

    it("handles July correctly (still FS)", () => {
      // HSG: FS runs Feb-Aug, so July is still FS
      vi.setSystemTime(new Date("2026-07-15"));
      expect(getCurrentSemesterKey()).toBe("FS26");
    });

    it("handles August correctly (transition to HS)", () => {
      // August (month 7, 0-indexed) is >= 8? No, so it's still FS
      // Actually wait - the logic is currentMonth >= 8, and August is 7
      // So August should be FS still. HS starts in September (8)
      vi.setSystemTime(new Date("2026-08-15"));
      expect(getCurrentSemesterKey()).toBe("FS26");
    });

    it("handles September correctly (start of HS)", () => {
      vi.setSystemTime(new Date("2026-09-15"));
      expect(getCurrentSemesterKey()).toBe("HS26");
    });
  });

  describe("getNextSemesterKey logic", () => {
    const getNextSemesterKey = (semesterKey) => {
      const type = semesterKey.substring(0, 2);
      const year = parseInt(semesterKey.substring(2), 10);
      if (type === "FS") {
        return `HS${year}`;
      } else {
        return `FS${year + 1}`;
      }
    };

    it("returns HS of same year after FS", () => {
      expect(getNextSemesterKey("FS27")).toBe("HS27");
      expect(getNextSemesterKey("FS25")).toBe("HS25");
    });

    it("returns FS of next year after HS", () => {
      expect(getNextSemesterKey("HS27")).toBe("FS28");
      expect(getNextSemesterKey("HS25")).toBe("FS26");
    });

    it("handles sequence correctly", () => {
      let sem = "FS25";
      sem = getNextSemesterKey(sem);
      expect(sem).toBe("HS25");
      sem = getNextSemesterKey(sem);
      expect(sem).toBe("FS26");
      sem = getNextSemesterKey(sem);
      expect(sem).toBe("HS26");
      sem = getNextSemesterKey(sem);
      expect(sem).toBe("FS27");
    });
  });

  describe("isSemesterCompleted logic", () => {
    const isSemesterCompleted = (semesterKey) => {
      const now = new Date();
      const currentYear = now.getFullYear() % 100;
      const currentMonth = now.getMonth();
      const isCurrentlyHS = currentMonth >= 8 || currentMonth <= 1;
      const currentSemYear =
        isCurrentlyHS && currentMonth <= 1 ? currentYear - 1 : currentYear;
      const currentSemKey = `${isCurrentlyHS ? "HS" : "FS"}${currentSemYear}`;
      return compareSemesters(semesterKey, currentSemKey) < 0;
    };

    it("returns true for past semesters", () => {
      vi.setSystemTime(new Date("2026-03-15")); // FS26
      expect(isSemesterCompleted("HS25")).toBe(true);
      expect(isSemesterCompleted("FS25")).toBe(true);
      expect(isSemesterCompleted("HS24")).toBe(true);
    });

    it("returns false for current semester", () => {
      vi.setSystemTime(new Date("2026-03-15")); // FS26
      expect(isSemesterCompleted("FS26")).toBe(false);
    });

    it("returns false for future semesters", () => {
      vi.setSystemTime(new Date("2026-03-15")); // FS26
      expect(isSemesterCompleted("HS26")).toBe(false);
      expect(isSemesterCompleted("FS27")).toBe(false);
      expect(isSemesterCompleted("HS27")).toBe(false);
    });
  });

  describe("isSemesterSyncable logic", () => {
    const isSemesterSyncable = (semesterKey) => {
      const now = new Date();
      const currentYear = now.getFullYear() % 100;
      const currentMonth = now.getMonth();
      const isCurrentlyHS = currentMonth >= 8 || currentMonth <= 1;
      const currentSemYear =
        isCurrentlyHS && currentMonth <= 1 ? currentYear - 1 : currentYear;
      const currentSemKey = `${isCurrentlyHS ? "HS" : "FS"}${currentSemYear}`;

      const nextSemType = isCurrentlyHS ? "FS" : "HS";
      const nextSemYear = isCurrentlyHS ? currentSemYear + 1 : currentSemYear;
      const nextSemKey = `${nextSemType}${nextSemYear}`;

      return semesterKey === currentSemKey || semesterKey === nextSemKey;
    };

    it("returns true for current semester", () => {
      vi.setSystemTime(new Date("2026-03-15")); // FS26
      expect(isSemesterSyncable("FS26")).toBe(true);
    });

    it("returns true for next semester", () => {
      vi.setSystemTime(new Date("2026-03-15")); // FS26, next is HS26
      expect(isSemesterSyncable("HS26")).toBe(true);
    });

    it("returns false for past semesters", () => {
      vi.setSystemTime(new Date("2026-03-15")); // FS26
      expect(isSemesterSyncable("HS25")).toBe(false);
      expect(isSemesterSyncable("FS25")).toBe(false);
    });

    it("returns false for far future semesters", () => {
      vi.setSystemTime(new Date("2026-03-15")); // FS26
      expect(isSemesterSyncable("FS27")).toBe(false);
      expect(isSemesterSyncable("HS27")).toBe(false);
    });

    it("handles fall semester correctly", () => {
      vi.setSystemTime(new Date("2025-10-15")); // HS25, next is FS26
      expect(isSemesterSyncable("HS25")).toBe(true);
      expect(isSemesterSyncable("FS26")).toBe(true);
      expect(isSemesterSyncable("HS26")).toBe(false);
    });
  });

  describe("compareSemesters", () => {
    it("correctly orders semesters chronologically", () => {
      expect(compareSemesters("FS25", "HS25")).toBeLessThan(0);
      expect(compareSemesters("HS25", "FS26")).toBeLessThan(0);
      expect(compareSemesters("FS26", "HS26")).toBeLessThan(0);
    });

    it("returns 0 for same semester", () => {
      expect(compareSemesters("FS26", "FS26")).toBe(0);
      expect(compareSemesters("HS25", "HS25")).toBe(0);
    });

    it("correctly identifies later semesters", () => {
      expect(compareSemesters("HS25", "FS25")).toBeGreaterThan(0);
      expect(compareSemesters("FS26", "HS25")).toBeGreaterThan(0);
    });

    it("handles year boundaries correctly", () => {
      expect(compareSemesters("HS25", "FS26")).toBeLessThan(0);
      expect(compareSemesters("FS26", "HS25")).toBeGreaterThan(0);
    });
  });
});

describe("useCurriculumPlan hook integration", () => {
  const wrapper = ({ children }) => <RecoilRoot>{children}</RecoilRoot>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("hook can be rendered without error", async () => {
    const { useCurriculumPlan } = await import("../useCurriculumPlan");

    const { result } = renderHook(() => useCurriculumPlan(), { wrapper });

    expect(result.current.moveCourse).toBeDefined();
    expect(result.current.addCourse).toBeDefined();
    expect(result.current.removeCourse).toBeDefined();
    expect(result.current.isSemesterSyncable).toBeDefined();
    expect(result.current.isSemesterCompleted).toBeDefined();
    expect(result.current.getCurrentSemesterKey).toBeDefined();
  });

  it("returns expected function types", async () => {
    const { useCurriculumPlan } = await import("../useCurriculumPlan");

    const { result } = renderHook(() => useCurriculumPlan(), { wrapper });

    expect(typeof result.current.moveCourse).toBe("function");
    expect(typeof result.current.addCourse).toBe("function");
    expect(typeof result.current.removeCourse).toBe("function");
    expect(typeof result.current.isSemesterSyncable).toBe("function");
    expect(typeof result.current.isSemesterCompleted).toBe("function");
    expect(typeof result.current.getCurrentSemesterKey).toBe("function");
  });

  it("getCurrentSemesterKey returns correct value", async () => {
    const { useCurriculumPlan } = await import("../useCurriculumPlan");

    const { result } = renderHook(() => useCurriculumPlan(), { wrapper });

    expect(result.current.getCurrentSemesterKey()).toBe("FS26");
  });

  it("isSemesterCompleted works correctly", async () => {
    const { useCurriculumPlan } = await import("../useCurriculumPlan");

    const { result } = renderHook(() => useCurriculumPlan(), { wrapper });

    expect(result.current.isSemesterCompleted("HS25")).toBe(true);
    expect(result.current.isSemesterCompleted("FS26")).toBe(false);
    expect(result.current.isSemesterCompleted("HS26")).toBe(false);
  });

  it("isSemesterSyncable works correctly", async () => {
    const { useCurriculumPlan } = await import("../useCurriculumPlan");

    const { result } = renderHook(() => useCurriculumPlan(), { wrapper });

    expect(result.current.isSemesterSyncable("FS26")).toBe(true);
    expect(result.current.isSemesterSyncable("HS26")).toBe(true);
    expect(result.current.isSemesterSyncable("FS27")).toBe(false);
  });

  it("addCourse rejects completed semesters", async () => {
    const { useCurriculumPlan } = await import("../useCurriculumPlan");

    const { result } = renderHook(() => useCurriculumPlan(), { wrapper });

    const course = { courseNumber: "ABC123", shortName: "Test", credits: 300 };
    const success = result.current.addCourse(course, "HS25", "Core/Electives");

    expect(success).toBe(false);
  });

  it("addCourse accepts valid semesters", async () => {
    const { useCurriculumPlan } = await import("../useCurriculumPlan");

    const { result } = renderHook(() => useCurriculumPlan(), { wrapper });

    const course = { courseNumber: "ABC123", shortName: "Test", credits: 300 };

    let success;
    act(() => {
      success = result.current.addCourse(course, "FS26", "Core/Electives");
    });

    expect(success).toBe(true);
  });

  it("moveCourse rejects completed semesters", async () => {
    const { useCurriculumPlan } = await import("../useCurriculumPlan");

    const { result } = renderHook(() => useCurriculumPlan(), { wrapper });

    const success = result.current.moveCourse(
      "ABC123",
      "FS26",
      "HS25",
      "Core",
      "wishlist",
    );

    expect(success).toBe(false);
  });

  it("moveCourse returns true for same semester (no-op)", async () => {
    const { useCurriculumPlan } = await import("../useCurriculumPlan");

    const { result } = renderHook(() => useCurriculumPlan(), { wrapper });

    const success = result.current.moveCourse(
      "ABC123",
      "FS26",
      "FS26",
      "Core",
      "wishlist",
    );

    expect(success).toBe(true);
  });

  it("removeCourse returns true", async () => {
    const { useCurriculumPlan } = await import("../useCurriculumPlan");

    const { result } = renderHook(() => useCurriculumPlan(), { wrapper });

    let success;
    act(() => {
      success = result.current.removeCourse("ABC123", "FS26", "wishlist");
    });

    expect(success).toBe(true);
  });

  it("addPlaceholder is defined and is a function", async () => {
    const { useCurriculumPlan } = await import("../useCurriculumPlan");

    const { result } = renderHook(() => useCurriculumPlan(), { wrapper });

    expect(result.current.addPlaceholder).toBeDefined();
    expect(typeof result.current.addPlaceholder).toBe("function");
  });

  it("removePlaceholder is defined and is a function", async () => {
    const { useCurriculumPlan } = await import("../useCurriculumPlan");

    const { result } = renderHook(() => useCurriculumPlan(), { wrapper });

    expect(result.current.removePlaceholder).toBeDefined();
    expect(typeof result.current.removePlaceholder).toBe("function");
  });

  it("addPlaceholder rejects completed semesters", async () => {
    const { useCurriculumPlan } = await import("../useCurriculumPlan");

    const { result } = renderHook(() => useCurriculumPlan(), { wrapper });

    let id;
    await act(async () => {
      id = await result.current.addPlaceholder(
        "HS25",
        "Core/Electives",
        6,
        "Elective",
      );
    });

    expect(id).toBe(null);
  });

  it("addPlaceholder accepts future semesters", async () => {
    const { useCurriculumPlan } = await import("../useCurriculumPlan");

    const { result } = renderHook(() => useCurriculumPlan(), { wrapper });

    let id;
    await act(async () => {
      id = await result.current.addPlaceholder(
        "HS27",
        "Core/Electives",
        6,
        "Elective",
      );
    });

    expect(id).toBeTruthy();
  });

  it("addPlaceholder uses default label when not provided", async () => {
    const { useCurriculumPlan } = await import("../useCurriculumPlan");

    const { result } = renderHook(() => useCurriculumPlan(), { wrapper });

    let id;
    await act(async () => {
      id = await result.current.addPlaceholder("HS27", "Core/Electives", 3);
    });

    expect(id).toBeTruthy();
  });

  it("removePlaceholder returns true", async () => {
    const { useCurriculumPlan } = await import("../useCurriculumPlan");

    const { result } = renderHook(() => useCurriculumPlan(), { wrapper });

    let success;
    await act(async () => {
      success = await result.current.removePlaceholder("placeholder-123");
    });

    expect(success).toBe(true);
  });
});
