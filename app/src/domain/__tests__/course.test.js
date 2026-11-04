import { describe, it, expect } from "vitest";
import { courseKey, courseRootKey, sameCourse, normalizeCourse } from "../course";

describe("courseKey", () => {
  it("prefers the nested course number", () => {
    expect(courseKey({ courses: [{ courseNumber: "a" }], courseNumber: "b" })).toBe("a");
  });

  it("prefers eventCourseNumber over id", () => {
    expect(courseKey({ eventCourseNumber: "e", id: "i" })).toBe("e");
  });

  it("falls back through courseNumber, id, number and _id", () => {
    expect(courseKey({ courseNumber: "c", id: "i" })).toBe("c");
    expect(courseKey({ id: "i", number: "n" })).toBe("i");
    expect(courseKey({ number: "n", _id: "m" })).toBe("n");
    expect(courseKey({ _id: "m" })).toBe("m");
  });

  it("returns null when there is no identifier", () => {
    expect(courseKey(null)).toBeNull();
    expect(courseKey({})).toBeNull();
  });
});

describe("courseRootKey", () => {
  it("reduces a course number to its two leading segments", () => {
    expect(courseRootKey({ courseNumber: "3,135,2.04" })).toBe("3,135");
  });

  it("uses courseId when no other identifier exists", () => {
    expect(courseRootKey({ courseId: "3,135,1.00" })).toBe("3,135");
  });

  it("returns null for a non-numeric identifier", () => {
    expect(courseRootKey({ id: "evt-123" })).toBeNull();
    expect(courseRootKey(undefined)).toBeNull();
  });
});

describe("sameCourse", () => {
  it("matches a legacy id against a course number", () => {
    expect(sameCourse({ id: "7,035,1.00" }, { courseNumber: "7,035,1.00" })).toBe(true);
  });

  it("matches across id and courseId", () => {
    expect(sameCourse({ courseNumber: "x", id: "evt-1" }, { courseId: "evt-1" })).toBe(true);
  });

  it("does not match different courses", () => {
    expect(sameCourse({ courseNumber: "a", id: "1" }, { courseNumber: "b", id: "2" })).toBe(false);
    expect(sameCourse(null, { id: "a" })).toBe(false);
    expect(sameCourse({}, {})).toBe(false);
  });
});

describe("normalizeCourse", () => {
  it("adds key, ects and rootKey and keeps every raw field", () => {
    const raw = { courseNumber: "3,135,1.00", credits: 300, shortName: "Micro" };
    const course = normalizeCourse(raw);
    expect(course).toEqual({ ...raw, key: "3,135,1.00", ects: 3, rootKey: "3,135" });
  });

  it("converts raw credits without touching them", () => {
    expect(normalizeCourse({ credits: 300 }).ects).toBe(3);
    expect(normalizeCourse({ credits: 300 }).credits).toBe(300);
  });

  it("keeps an exercise group's 0 credits", () => {
    expect(normalizeCourse({ credits: 0 }).ects).toBe(0);
  });
});
