/**
 * Row components must keep their identity across renders of the list.
 *
 * A component type declared inside EventListContainer's render body is a new
 * type on every render, so React unmounts and remounts every visible row each
 * time any input of the container changes (e.g. a keystroke in the search box).
 */

import { act, render, screen } from "@testing-library/react";
import { RecoilRoot, useSetRecoilState } from "recoil";
import { describe, expect, it, vi } from "vitest";
import { authTokenState } from "../../../recoil/authAtom";
import { selectionOptionsState } from "../../../recoil/selectionOptionsAtom";
import { unifiedCourseDataState } from "../../../recoil/unifiedCourseDataAtom";
import EventListContainer from "../EventListContainer";

// AutoSizer measures to 0x0 in jsdom, which would render no rows at all.
vi.mock("react-virtualized-auto-sizer", () => ({
  default: ({ children }) => children({ height: 600, width: 400 }),
}));

// The data manager only coordinates fetching; the seeded atom is the fixture.
vi.mock("../../../helpers/useEventListDataManager", () => ({
  useEventListDataManager: () => ({ isLoading: false }),
}));

const SEMESTER = "HS25";

const COURSES = [
  {
    id: "ml",
    courseNumber: "7,214,1.00",
    shortName: "Machine Learning",
    classification: "Core",
    credits: 400,
  },
  {
    id: "dv",
    courseNumber: "8,180,1.00",
    shortName: "Data Visualisation",
    classification: "Elective",
    credits: 400,
  },
];

const TERM_LIST = [
  {
    cisId: "cis-hs25",
    id: "hs25",
    shortName: SEMESTER,
    isCurrent: true,
    isProjected: false,
  },
];

const seedState = ({ set }) => {
  set(authTokenState, "test-token");
  set(unifiedCourseDataState, {
    semesters: {
      [SEMESTER]: {
        enrolledIds: [],
        available: COURSES,
        selectedIds: [],
        studyPlan: [],
        ratings: {},
        lastFetched: null,
        isFutureSemester: false,
        referenceSemester: null,
        cisId: "cis-hs25",
        isCurrent: true,
        isProjected: false,
      },
    },
    selectedSemester: SEMESTER,
    latestValidTerm: SEMESTER,
    selectedCourseInfo: null,
  });
};

let setSelectionOptions;
const SelectionOptionsHarness = () => {
  setSelectionOptions = useSetRecoilState(selectionOptionsState);
  return null;
};

const renderList = () =>
  render(
    <RecoilRoot initializeState={seedState}>
      <SelectionOptionsHarness />
      <EventListContainer
        termListObject={TERM_LIST}
        selectedSemesterShortName={SEMESTER}
      />
    </RecoilRoot>
  );

describe("EventListContainer row identity", () => {
  it("keeps the same row DOM nodes when the search term changes", async () => {
    renderList();
    const before = await screen.findAllByTestId("course-list-row");
    act(() => {
      setSelectionOptions((prev) => ({ ...prev, searchTerm: "" })); // same filter, new object
    });
    const after = await screen.findAllByTestId("course-list-row");
    expect(after[0]).toBe(before[0]);
  });
});
