// Catalog ingestion decides a course's ECTS for every surface reading
// `semesters[*].available`: the course list, Course Info and the summary.

import { act, renderHook } from "@testing-library/react";
import { RecoilRoot, useRecoilValue } from "recoil";
import { describe, expect, it } from "vitest";
import { unifiedCourseDataState } from "../../recoil/unifiedCourseDataAtom";
import { useUnifiedCourseData } from "../useUnifiedCourseData";

const wrapper = ({ children }) => <RecoilRoot>{children}</RecoilRoot>;

const renderUnifiedData = () =>
  renderHook(
    () => ({
      api: useUnifiedCourseData(),
      state: useRecoilValue(unifiedCourseDataState),
    }),
    { wrapper }
  );

/** A catalog parent carrying one nested event, as the courses API sends it. */
const parentWith = (event) => ({
  id: `parent-${event.courseNumber}`,
  courseNumber: event.courseNumber,
  shortName: event.shortName,
  credits: event.credits,
  courses: [event],
});

const availableOf = (result, semester) =>
  result.current.state.semesters[semester].available;

const creditsOf = (available, courseNumber) =>
  available.find((c) => c.courseNumber === courseNumber)?.credits;

describe("updateAvailableCourses ECTS ingestion", () => {
  it("zeroes a Selbststudium companion that has a main event in the same catalog", () => {
    const { result } = renderUnifiedData();

    act(() => {
      result.current.api.updateAvailableCourses("HS26", [
        parentWith({
          id: "main",
          courseNumber: "3,105,1.00",
          shortName: "Methoden: Empirische Sozialforschung",
          credits: 400,
        }),
        parentWith({
          id: "companion",
          courseNumber: "3,105,3.00",
          shortName: "Methoden: Empirische Sozialforschung: Selbststudium",
          credits: 400,
        }),
      ]);
    });

    const available = availableOf(result, "HS26");
    expect(creditsOf(available, "3,105,1.00")).toBe(400);
    expect(creditsOf(available, "3,105,3.00")).toBe(0);
  });

  it("still zeroes classic exercise groups", () => {
    const { result } = renderUnifiedData();

    act(() => {
      result.current.api.updateAvailableCourses("HS26", [
        parentWith({
          id: "main",
          courseNumber: "4,135,1.00",
          shortName: "Linear Algebra",
          credits: 400,
        }),
        parentWith({
          id: "ex",
          courseNumber: "4,135,2.01",
          shortName: "Linear Algebra: Exercises, Group 1",
          credits: 400,
        }),
      ]);
    });

    const available = availableOf(result, "HS26");
    expect(creditsOf(available, "4,135,1.00")).toBe(400);
    expect(creditsOf(available, "4,135,2.01")).toBe(0);
  });

  it("leaves distinct courses that only share a name untouched", () => {
    // The catalog is ~2000 events; name-based grouping would zero the second of
    // these two unrelated colloquia.
    const { result } = renderUnifiedData();

    act(() => {
      result.current.api.updateAvailableCourses("HS26", [
        parentWith({
          id: "a",
          courseNumber: "1,001,1.00",
          shortName: "Kolloquium",
          credits: 200,
        }),
        parentWith({
          id: "b",
          courseNumber: "2,002,1.00",
          shortName: "Kolloquium",
          credits: 200,
        }),
      ]);
    });

    const available = availableOf(result, "HS26");
    expect(creditsOf(available, "1,001,1.00")).toBe(200);
    expect(creditsOf(available, "2,002,1.00")).toBe(200);
  });

  it("keeps a sub-numbered course that has no main event and no companion name", () => {
    const { result } = renderUnifiedData();

    act(() => {
      result.current.api.updateAvailableCourses("HS26", [
        parentWith({
          id: "orphan",
          courseNumber: "9,999,2.00",
          shortName: "Advanced Topics in Public Finance",
          credits: 400,
        }),
      ]);
    });

    expect(creditsOf(availableOf(result, "HS26"), "9,999,2.00")).toBe(400);
  });

  it("flattens nested events and keeps only their own calendar entries", () => {
    // Pinned because the ECTS pass now runs after flattening: the restructure
    // must not disturb what flattening produces.
    const { result } = renderUnifiedData();

    act(() => {
      result.current.api.updateAvailableCourses("HS26", [
        {
          id: "parent",
          courseNumber: "3,105,1.00",
          shortName: "Methoden: Empirische Sozialforschung",
          credits: 400,
          calendarEntry: [
            { courseNumber: "3,105,1.00", eventDate: "2026-09-21" },
            { courseNumber: "3,105,3.00", eventDate: "2026-09-22" },
          ],
          courses: [
            {
              id: "main",
              courseNumber: "3,105,1.00",
              shortName: "Methoden: Empirische Sozialforschung",
              credits: 400,
            },
            {
              id: "companion",
              courseNumber: "3,105,3.00",
              shortName: "Methoden: Empirische Sozialforschung: Selbststudium",
              credits: 400,
            },
          ],
        },
      ]);
    });

    const available = availableOf(result, "HS26");
    expect(available).toHaveLength(2);
    expect(available.every((c) => c.courses === undefined)).toBe(true);
    expect(
      available.find((c) => c.courseNumber === "3,105,1.00").calendarEntry
    ).toEqual([{ courseNumber: "3,105,1.00", eventDate: "2026-09-21" }]);
    expect(creditsOf(available, "3,105,3.00")).toBe(0);
  });
});
