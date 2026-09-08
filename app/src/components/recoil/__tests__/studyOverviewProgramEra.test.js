/**
 * Regression tests for studyOverviewViewSelector's programme-era scoping.
 *
 * Saved courses arrive from the server keyed by semester alone, with no
 * programme attached. A student who used the app during a Bachelor and is now
 * in a Master would otherwise see HS22/FS23 wishlist entries handed to the
 * Master programme and enriched from today's catalogue — landing inside Master
 * categories under today's names and credits.
 */

import { describe, expect, it } from "vitest";
import { snapshot_UNSTABLE } from "recoil";

import { unifiedAcademicDataState } from "../unifiedAcademicDataAtom";
import { unifiedCourseDataState } from "../unifiedCourseDataAtom";
import { studyOverviewViewSelector } from "../unifiedAcademicDataSelectors";

const scorecard = (semesters) => ({
  items: [
    {
      isTitle: true,
      hierarchy: "1",
      hierarchyLevel: 1,
      description: "Programme",
      items: semesters.map((semester, index) => ({
        isDetail: true,
        isTitle: false,
        id: `${semester}-${index}`,
        shortName: `Completed ${semester}`,
        semester,
        sumOfCredits: "4.00",
        gradeText: "pass",
        hierarchyParent: "1",
      })),
    },
  ],
});

const program = (semesters, { isMainStudy = false } = {}) => ({
  transcript: { rawScorecard: scorecard(semesters) },
  studyPlan: { semesterMap: {} },
  metadata: { isMainStudy },
});

const catalogue = (courseNumber, shortName) => ({
  id: courseNumber,
  courseNumber,
  shortName,
  credits: 400,
  classification: "Contextual Studies",
});

/** Every course id the selector hands to a programme's planned rows. */
const plannedIdsBySemester = (programView) =>
  Object.fromEntries(
    Object.entries(programView).map(([semesterKey, data]) => [
      semesterKey,
      (data.selectedCourses || []).map((course) => course.courseId),
    ])
  );

const readOverview = (programs, semesters) =>
  snapshot_UNSTABLE(({ set }) => {
    set(unifiedAcademicDataState, {
      programs,
      currentProgram: null,
      initialization: { isLoading: false, isInitialized: true, error: null },
    });
    set(unifiedCourseDataState, {
      semesters,
      selectedSemester: "HS26",
      latestValidTerm: "HS26",
      selectedCourseInfo: null,
    });
  }).getLoadable(studyOverviewViewSelector).getValue();

describe("studyOverviewViewSelector - programme era scoping", () => {
  it("keeps Bachelor-era saved courses out of the Master's planned rows", () => {
    const overview = readOverview(
      {
        "Bachelor of Arts": program(["HS 22", "FS 23"]),
        "Master of Arts": program(["HS 25", "HS 26"], { isMainStudy: true }),
      },
      {
        HS22: { selectedIds: ["7,015,1.00"], available: [] },
        HS25: { selectedIds: ["11,702,1.00"], available: [] },
        HS26: {
          selectedIds: ["8,404,1.00"],
          available: [catalogue("8,404,1.00", "Managerial Impact Project")],
          isCurrent: true,
        },
      }
    );

    expect(plannedIdsBySemester(overview["Master of Arts"])).toEqual({
      HS22: [],
      HS25: ["11,702,1.00"],
      HS26: ["8,404,1.00"],
    });
  });

  it("also withholds pre-era enrolments from the main programme", () => {
    const overview = readOverview(
      { "Master of Arts": program(["HS 25"], { isMainStudy: true }) },
      {
        FS23: { enrolledIds: ["7,015,1.00"], available: [] },
        HS25: { enrolledIds: ["11,702,1.00"], available: [] },
      }
    );

    expect(plannedIdsBySemester(overview["Master of Arts"])).toEqual({
      FS23: [],
      HS25: ["11,702,1.00"],
    });
  });

  it("starts a fresh Master's era after the Bachelor's last semester", () => {
    // No dated Master items yet; the Bachelor ended FS26, so the era is HS26.
    const overview = readOverview(
      {
        "Bachelor of Arts": program(["HS 22", "FS 26"]),
        "Master of Arts": program([], { isMainStudy: true }),
      },
      {
        HS22: { selectedIds: ["7,015,1.00"], available: [] },
        FS26: { selectedIds: ["7,214,1.00"], available: [] },
        HS26: { selectedIds: ["8,404,1.00"], available: [] },
      }
    );

    expect(plannedIdsBySemester(overview["Master of Arts"])).toEqual({
      HS22: [],
      FS26: [],
      HS26: ["8,404,1.00"],
    });
  });

  it("scopes nothing away for a single programme with no dated items", () => {
    const overview = readOverview(
      { "Bachelor of Arts": program([], { isMainStudy: true }) },
      {
        HS22: { selectedIds: ["7,015,1.00"], available: [] },
        HS26: { selectedIds: ["8,404,1.00"], available: [] },
      }
    );

    expect(plannedIdsBySemester(overview["Bachelor of Arts"])).toEqual({
      HS22: ["7,015,1.00"],
      HS26: ["8,404,1.00"],
    });
  });

  it("leaves other programmes' own enrolments untouched", () => {
    const overview = readOverview(
      {
        "Bachelor of Arts": program(["HS 22"]),
        "Master of Arts": program(["HS 25"], { isMainStudy: true }),
      },
      { HS22: { enrolledIds: ["7,015,1.00"], available: [] } }
    );

    expect(plannedIdsBySemester(overview["Bachelor of Arts"])).toEqual({
      HS22: ["7,015,1.00"],
    });
  });
});
