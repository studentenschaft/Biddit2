// A wishlist id that resolves in no loaded catalog must not reach Study
// Overview as a permanent "Loading course details..." bar counted at 3 ECTS,
// so Summary, Study Overview and the curriculum map agree.

import { describe, expect, it } from "vitest";
import { snapshot_UNSTABLE } from "recoil";
import { unifiedAcademicDataState } from "../unifiedAcademicDataAtom";
import { unifiedCourseDataState } from "../unifiedCourseDataAtom";
import { studyOverviewViewSelector } from "../unifiedAcademicDataSelectors";

const PROGRAM = "Bachelor in Business Administration";

const catalogue = (courseNumber, shortName) => ({
  id: courseNumber,
  courseNumber,
  shortName,
  credits: 400,
  classification: "Core Studies",
});

const COURSE = catalogue("7,035,1.00", "Corporate Finance");
const OTHER_TERM_COURSE = catalogue("9,999,1.00", "Offered Last Spring");

const readHs26 = (semesters) =>
  snapshot_UNSTABLE(({ set }) => {
    set(unifiedAcademicDataState, {
      programs: {
        [PROGRAM]: {
          transcript: {
            rawScorecard: {
              items: [
                {
                  isTitle: true,
                  hierarchy: "1",
                  hierarchyLevel: 1,
                  description: PROGRAM,
                  items: [
                    {
                      isDetail: true,
                      isTitle: false,
                      id: "done-1",
                      shortName: "Completed HS25",
                      semester: "HS25",
                      sumOfCredits: "4.00",
                      gradeText: "pass",
                      hierarchyParent: "1",
                    },
                  ],
                },
              ],
            },
          },
          studyPlan: { semesterMap: {} },
          metadata: { isMainStudy: true },
        },
      },
      currentProgram: PROGRAM,
      initialization: { isLoading: false, isInitialized: true, error: null },
    });
    set(unifiedCourseDataState, {
      semesters,
      selectedSemester: "HS26",
      latestValidTerm: "HS26",
      selectedCourseInfo: null,
    });
  })
    .getLoadable(studyOverviewViewSelector)
    .getValue()[PROGRAM].HS26.selectedCourses;

const HS26 = {
  enrolledIds: [],
  selectedIds: [COURSE.courseNumber, OTHER_TERM_COURSE.courseNumber],
  available: [COURSE],
};

describe("studyOverviewViewSelector - unresolved wishlist ids", () => {
  it("drops a wishlist id that resolves in no loaded catalog", () => {
    const planned = readHs26({ HS26 });

    expect(planned.map((c) => c.courseId)).toEqual([COURSE.courseNumber]);
    expect(planned.reduce((sum, c) => sum + c.credits, 0)).toBe(4);
    expect(planned.every((c) => c.isEnriched && c.name !== c.courseId)).toBe(true);
  });

  it("keeps a wishlist id that resolves in another loaded semester's catalog", () => {
    const planned = readHs26({
      HS26,
      FS26: { enrolledIds: [], selectedIds: [], available: [OTHER_TERM_COURSE] },
    });

    expect(planned.map((c) => c.courseId)).toEqual([
      COURSE.courseNumber,
      OTHER_TERM_COURSE.courseNumber,
    ]);
    expect(planned[1]).toMatchObject({
      name: "Offered Last Spring",
      credits: 4,
      isEnriched: true,
    });
  });
});
