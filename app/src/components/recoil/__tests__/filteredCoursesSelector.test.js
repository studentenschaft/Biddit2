// The course list's filtered pool is derived from `available`, the id lists,
// the ratings and the filter options; nothing stores it.

import { createElement } from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecoilRoot, snapshot_UNSTABLE, useRecoilValue } from "recoil";
import { useUnifiedCourseData } from "../../helpers/useUnifiedCourseData";
import { selectionOptionsState } from "../selectionOptionsAtom";
import { unifiedCourseDataState } from "../unifiedCourseDataAtom";
import {
  filteredCoursesSelector,
  semesterCoursesSelector,
} from "../unifiedCourseDataSelectors";

const NO_FILTERS = {
  searchTerm: "",
  classifications: [],
  ects: [],
  ratings: [],
  courseLanguage: [],
  lecturer: [],
};

const course = (courseNumber, shortName) => ({
  id: `id-${courseNumber}`,
  courseNumber,
  shortName,
  credits: 4,
});

// Deliberately unsorted: the selector must put enrolled, then selected first.
const AVAILABLE = [
  course("other-1", "Other Course"),
  course("selected-1", "Selected Course"),
  course("enrolled-1", "Enrolled Course"),
];

const readFiltered = (selectionOptions = NO_FILTERS) => {
  const snapshot = snapshot_UNSTABLE(({ set }) => {
    set(unifiedCourseDataState, {
      semesters: {
        HS25: {
          available: AVAILABLE,
          enrolledIds: ["enrolled-1"],
          selectedIds: ["selected-1"],
        },
      },
      ratings: { "other-1": 4.2 },
      selectedSemester: "HS25",
      latestValidTerm: "HS25",
      selectedCourseInfo: null,
    });
    set(selectionOptionsState, selectionOptions);
  });
  return {
    filtered: snapshot.getLoadable(filteredCoursesSelector("HS25")).getValue(),
    viaSemesterCourses: snapshot
      .getLoadable(semesterCoursesSelector({ semester: "HS25", type: "filtered" }))
      .getValue(),
  };
};

describe("filteredCoursesSelector", () => {
  it("attaches status flags and ratings and sorts enrolled, then selected", () => {
    const { filtered: result } = readFiltered();

    expect(result.map((c) => c.courseNumber)).toEqual([
      "enrolled-1",
      "selected-1",
      "other-1",
    ]);
    expect(result[0].enrolled).toBe(true);
    expect(result[1].selected).toBe(true);
    expect(result[2].avgRating).toBe(4.2);
  });

  it("applies the keyword filter", () => {
    const { filtered } = readFiltered({ ...NO_FILTERS, searchTerm: "other" });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].courseNumber).toBe("other-1");
  });

  it("is what semesterCoursesSelector returns for type filtered", () => {
    const { filtered, viaSemesterCourses } = readFiltered();

    expect(viaSemesterCourses).toBe(filtered);
  });
});

describe("course ratings", () => {
  const RATED = course("7,035,1.00", "Rated Course");

  const renderWithRatings = () =>
    renderHook(
      () => ({
        api: useUnifiedCourseData(),
        state: useRecoilValue(unifiedCourseDataState),
        filtered: useRecoilValue(filteredCoursesSelector("HS25")),
      }),
      {
        wrapper: ({ children }) =>
          createElement(
            RecoilRoot,
            {
              initializeState: ({ set }) =>
                set(unifiedCourseDataState, {
                  semesters: {
                    HS25: { available: [RATED], enrolledIds: [], selectedIds: [] },
                  },
                  ratings: {},
                  selectedSemester: "HS25",
                  latestValidTerm: "HS25",
                  selectedCourseInfo: null,
                }),
            },
            children
          ),
      }
    );

  it("updating ratings does not replace semester objects", () => {
    const { result } = renderWithRatings();
    const before = result.current.state.semesters.HS25;

    act(() =>
      result.current.api.updateCourseRatings([
        { _id: "7,035,1.00", avgRating: 4.5 },
      ])
    );

    expect(result.current.state.semesters.HS25).toBe(before);
    expect(result.current.filtered[0].avgRating).toBe(4.5);
  });

  it("keeps the ratings when the selected course info changes", () => {
    const { result } = renderWithRatings();

    act(() =>
      result.current.api.updateCourseRatings([
        { _id: "7,035,1.00", avgRating: 4.5 },
      ])
    );
    act(() => result.current.api.updateSelectedCourseInfo(RATED));

    expect(result.current.state.ratings).toEqual({ "7,035,1.00": 4.5 });
  });
});
