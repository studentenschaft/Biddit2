// The study plan's wishlist entries come from the unified selectedIds, so the
// server-loaded wishlist counts after a reload, not only this session's clicks.

import { describe, expect, it } from "vitest";
import { snapshot_UNSTABLE } from "recoil";
import { unifiedAcademicDataState } from "../unifiedAcademicDataAtom";
import { unifiedCourseDataState } from "../unifiedCourseDataAtom";
import { unifiedStudyPlanSelector } from "../unifiedAcademicDataSelectors";

const PROGRAM = "Bachelor in Business Administration";
const COURSE_ID = "7,035,1.00";

const readStudyPlan = (selectedIds) =>
  snapshot_UNSTABLE(({ set }) => {
    set(unifiedAcademicDataState, {
      programs: {
        [PROGRAM]: {
          transcript: {
            rawScorecard: {
              items: [{ isTitle: true, shortName: "Core Studies", items: [] }],
            },
          },
          studyPlan: {
            semesterMap: { HS25: { enrolledCourses: [], selectedCourses: [] } },
          },
          metadata: { isMainStudy: true },
        },
      },
      currentProgram: PROGRAM,
      initialization: { isLoading: false, isInitialized: true, error: null },
    });
    set(unifiedCourseDataState, {
      semesters: {
        HS25: {
          enrolledIds: [],
          selectedIds,
          available: [
            {
              id: "event-guid-1",
              courseNumber: COURSE_ID,
              shortName: "Corporate Finance",
              credits: 400,
              classification: "Core Studies",
            },
          ],
        },
      },
      selectedSemester: "HS25",
      latestValidTerm: "HS25",
      selectedCourseInfo: null,
    });
  })
    .getLoadable(unifiedStudyPlanSelector)
    .getValue();

describe("unifiedStudyPlanSelector", () => {
  it("adds each selected course as a wishlist entry resolved from the catalog", () => {
    const plan = readStudyPlan([COURSE_ID]);

    expect(plan[PROGRAM].HS25).toEqual([
      expect.objectContaining({
        id: COURSE_ID,
        name: "Corporate Finance",
        credits: 4,
        type: "Core Studies-wishlist",
        big_type: "core",
      }),
    ]);
  });

  it("has no wishlist entries when nothing is selected", () => {
    expect(readStudyPlan([])[PROGRAM].HS25).toEqual([]);
  });
});
