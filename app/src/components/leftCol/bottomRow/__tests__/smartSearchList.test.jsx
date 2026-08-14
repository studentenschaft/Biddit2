/**
 * Smart search feeds the shared course-list rows.
 *
 * This is the automated stand-in for the manual smoke test: a semantic query
 * goes out over the mocked vector-DB endpoint, its ids come back, and the
 * results render through EventListContainer's normal Row — which is what makes
 * add/lock, drag-to-curriculum-map and click-to-details work for smart results.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RecoilRoot, useRecoilValue, useSetRecoilState } from "recoil";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "../../../../test/mocks/server";
import { authTokenState } from "../../../recoil/authAtom";
import { selectedTabAtom } from "../../../recoil/selectedTabAtom";
import { selectionOptionsState } from "../../../recoil/selectionOptionsAtom";
import { smartSearchState } from "../../../recoil/smartSearchAtom";
import { unifiedAcademicDataState } from "../../../recoil/unifiedAcademicDataAtom";
import { unifiedCourseDataState } from "../../../recoil/unifiedCourseDataAtom";
import { selectedCourseInfoSelector } from "../../../recoil/unifiedCourseDataSelectors";
import { TAB } from "../../../../constants/tabs";
import SearchModeToggle from "../../topRow/SearchModeToggle";
import { SearchTerm } from "../../topRow/SearchTerm";
import EventListContainer from "../EventListContainer";

vi.mock("react-ga4", () => ({ default: { event: vi.fn() } }));

// AutoSizer measures to 0x0 in jsdom, which would render no rows at all.
vi.mock("react-virtualized-auto-sizer", () => ({
  default: ({ children }) => children({ height: 600, width: 400 }),
}));

// The data manager only coordinates fetching; the seeded atom is the fixture.
vi.mock("../../../helpers/useEventListDataManager", () => ({
  useEventListDataManager: () => ({ isLoading: false }),
  default: () => ({ isLoading: false }),
}));

const SEMESTER = "HS25";
const OTHER_SEMESTER = "FS26";

const ML = {
  id: "ml",
  courseNumber: "7,214,1.00",
  shortName: "Machine Learning",
  classification: "Core",
  credits: 400,
};
const DATAVIZ = {
  id: "dv",
  courseNumber: "8,180,1.00",
  shortName: "Data Visualisation",
  classification: "Elective",
  credits: 400,
};
const KEYWORD_ONLY = {
  id: "kw",
  courseNumber: "1,001,1.00",
  shortName: "Keyword Only Course",
  classification: "Core",
  credits: 400,
};
// Only in the other semester's catalog, so its presence proves which semester
// the list is actually reading.
const NEXT_TERM_COURSE = {
  id: "nt",
  courseNumber: "2,002,1.00",
  shortName: "Next Term Course",
  classification: "Core",
  credits: 400,
};

const TERM_LIST = [
  {
    cisId: "cis-hs25",
    id: "hs25",
    shortName: SEMESTER,
    isCurrent: true,
    isProjected: false,
  },
  {
    cisId: "cis-fs26",
    id: "fs26",
    shortName: OTHER_SEMESTER,
    isCurrent: false,
    isProjected: false,
  },
];

const seedState = ({ set }) => {
  set(authTokenState, "test-token");
  set(unifiedAcademicDataState, {
    programs: { "Bachelor in Information Systems": {} },
    currentProgram: "Bachelor in Information Systems",
    initialization: { isLoading: false, isInitialized: true, error: null },
  });
  set(unifiedCourseDataState, {
    semesters: {
      [SEMESTER]: {
        enrolledIds: [],
        available: [ML, DATAVIZ, KEYWORD_ONLY],
        selectedIds: [DATAVIZ.courseNumber],
        filtered: [KEYWORD_ONLY],
        studyPlan: [],
        ratings: {},
        lastFetched: null,
        isFutureSemester: false,
        referenceSemester: null,
        usingReferenceData: false,
        cisId: "cis-hs25",
        isCurrent: true,
        isProjected: false,
      },
      [OTHER_SEMESTER]: {
        enrolledIds: [],
        available: [NEXT_TERM_COURSE],
        selectedIds: [],
        filtered: [NEXT_TERM_COURSE],
        studyPlan: [],
        ratings: {},
        lastFetched: null,
        isFutureSemester: false,
        referenceSemester: null,
        usingReferenceData: false,
        cisId: "cis-fs26",
        isCurrent: false,
        isProjected: false,
      },
    },
    selectedSemester: SEMESTER,
    latestValidTerm: SEMESTER,
    selectedCourseInfo: null,
  });
};

const TabProbe = () => {
  const tab = useRecoilValue(selectedTabAtom);
  const course = useRecoilValue(selectedCourseInfoSelector);
  const { searchTerm } = useRecoilValue(selectionOptionsState);
  const { hasSearched } = useRecoilValue(smartSearchState);
  return (
    <>
      <output aria-label="tab">{tab}</output>
      <output aria-label="details">{course?.shortName ?? "none"}</output>
      <output aria-label="keyword-filter">{searchTerm || "(empty)"}</output>
      <output aria-label="has-searched">{String(hasSearched)}</output>
    </>
  );
};

/**
 * Mirrors SelectOptions, which renders <SearchTerm key={mode}>: the remount is
 * the only thing that empties the visible box on a mode switch, so a harness
 * without the key would silently pass a broken production wiring.
 */
const KeyedSearchTerm = () => {
  const { mode } = useRecoilValue(smartSearchState);
  return <SearchTerm key={mode} />;
};

/**
 * Mirrors production, where the semester prop and `selectedSemester` in the atom
 * come from the same source and therefore always move together — a harness that
 * pinned the prop could not observe a semester switch at all.
 */
const SemesterAwareList = () => {
  const { selectedSemester } = useRecoilValue(unifiedCourseDataState);
  const setCourseData = useSetRecoilState(unifiedCourseDataState);
  return (
    <>
      <EventListContainer
        termListObject={TERM_LIST}
        selectedSemesterShortName={selectedSemester}
      />
      {[SEMESTER, OTHER_SEMESTER].map((semester) => (
        <button
          key={semester}
          type="button"
          onClick={() =>
            setCourseData((prev) => ({ ...prev, selectedSemester: semester }))
          }
        >
          {`switch to ${semester}`}
        </button>
      ))}
    </>
  );
};

const switchSemester = (semester) =>
  fireEvent.click(screen.getByRole("button", { name: `switch to ${semester}` }));

const renderList = (extraSeed) =>
  render(
    <RecoilRoot
      initializeState={(recoilInterface) => {
        seedState(recoilInterface);
        extraSeed?.(recoilInterface);
      }}
    >
      <SearchModeToggle />
      <KeyedSearchTerm />
      <SemesterAwareList />
      <TabProbe />
    </RecoilRoot>
  );

const mockVectorHits = () =>
  server.use(
    http.get("https://api.shsg.ch/similar-courses/query", () =>
      HttpResponse.json({
        ids: [
          [
            `9,999,1.00${SEMESTER}`, // not in this semester's catalog → dropped
            `${DATAVIZ.courseNumber}${SEMESTER}`,
            `${ML.courseNumber}${SEMESTER}`,
          ],
        ],
        distances: [[0.9, 0.5, 0.1]],
        metadatas: [[]],
      })
    )
  );

/**
 * Registers the upsert endpoint and counts the calls, so tests can assert that
 * the expensive full-catalog upsert only fires on an explicit empty ids list.
 */
const countUpserts = () => {
  const calls = { count: 0 };
  server.use(
    http.post("https://api.shsg.ch/similar-courses/upsert", () => {
      calls.count += 1;
      return HttpResponse.json({ success: true });
    })
  );
  return calls;
};

const runSmartSearch = (query = "programming basics") => {
  fireEvent.click(screen.getByRole("button", { name: /smart/i }));
  const input = screen.getByPlaceholderText("Describe what you want to learn…");
  fireEvent.change(input, { target: { value: query } });
  fireEvent.keyDown(input, { key: "Enter" });
};

describe("smart search in the course list", () => {
  it("keeps showing the keyword-filtered pool until a smart query runs", () => {
    renderList();
    expect(screen.getByText("Keyword Only Course")).toBeInTheDocument();
    expect(screen.queryByText("Machine Learning")).not.toBeInTheDocument();
  });

  it("renders vector-DB results through the shared rows, best match first", async () => {
    mockVectorHits();
    renderList();
    runSmartSearch();

    await waitFor(() =>
      expect(screen.getByText("Machine Learning")).toBeInTheDocument()
    );
    expect(screen.getByText("Data Visualisation")).toBeInTheDocument();
    // The keyword pool is replaced, and ids with no matching course are dropped.
    expect(screen.queryByText("Keyword Only Course")).not.toBeInTheDocument();

    const rendered = screen
      .getAllByText(/Machine Learning|Data Visualisation/)
      .map((node) => node.textContent);
    expect(rendered).toEqual(["Machine Learning", "Data Visualisation"]);
  });

  it("opens course details when a smart result row is clicked", async () => {
    mockVectorHits();
    renderList();
    runSmartSearch();

    await waitFor(() =>
      expect(screen.getByText("Machine Learning")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText("Machine Learning"));

    expect(screen.getByLabelText("tab")).toHaveTextContent(TAB.COURSE_DETAILS);
    expect(screen.getByLabelText("details")).toHaveTextContent(
      "Machine Learning"
    );
  });

  it("marks an already-wishlisted smart result as selected", async () => {
    mockVectorHits();
    renderList();
    runSmartSearch();

    await waitFor(() =>
      expect(screen.getByText("Data Visualisation")).toBeInTheDocument()
    );

    const selectedRow = screen
      .getByText("Data Visualisation")
      .closest("div.flex.w-full");
    const otherRow = screen
      .getByText("Machine Learning")
      .closest("div.flex.w-full");

    expect(
      selectedRow.querySelector("#select_course").className
    ).toContain("border-main");
    expect(
      otherRow.querySelector("#select_course").className
    ).not.toContain("border-main");
  });

  it("upserts the catalog and retries when the ids list comes back empty", async () => {
    const upserts = countUpserts();
    server.use(
      http.get("https://api.shsg.ch/similar-courses/query", () =>
        HttpResponse.json({ ids: [[]], distances: [[]], metadatas: [[]] })
      )
    );
    renderList();
    runSmartSearch();

    await waitFor(() =>
      expect(screen.getByText("No matching courses found")).toBeInTheDocument()
    );
    // Once only: the retry carries attemptedUpsert, so it must not loop.
    expect(upserts.count).toBe(1);
  });

  it("never upserts when the response carries no ids list at all", async () => {
    const upserts = countUpserts();
    server.use(
      http.get("https://api.shsg.ch/similar-courses/query", () =>
        HttpResponse.json({ message: "no embeddings" })
      )
    );
    renderList();
    runSmartSearch();

    await waitFor(() =>
      expect(screen.getByText("No matching courses found")).toBeInTheDocument()
    );
    // A body without `ids` is the DB declining to answer — posting the whole
    // catalog on the back of it would be a ~1500-course write for nothing.
    expect(upserts.count).toBe(0);
    // And the search must settle rather than hang on the loading row.
    expect(screen.queryByText("Loading courses...")).not.toBeInTheDocument();
  });

  it("falls back to the keyword pool when the semester changes under the results", async () => {
    mockVectorHits();
    renderList();
    runSmartSearch();

    await waitFor(() =>
      expect(screen.getByText("Machine Learning")).toBeInTheDocument()
    );

    switchSemester(OTHER_SEMESTER);

    // The ids answer the old semester's question; resolving them against the new
    // semester's catalog would rank whatever happens to share a course number.
    await waitFor(() =>
      expect(screen.getByText("Next Term Course")).toBeInTheDocument()
    );
    expect(screen.queryByText("Machine Learning")).not.toBeInTheDocument();
    expect(screen.queryByText("Data Visualisation")).not.toBeInTheDocument();
  });

  it("shows the results again when the queried semester is reselected", async () => {
    mockVectorHits();
    renderList();
    runSmartSearch();

    await waitFor(() =>
      expect(screen.getByText("Machine Learning")).toBeInTheDocument()
    );

    switchSemester(OTHER_SEMESTER);
    await waitFor(() =>
      expect(screen.getByText("Next Term Course")).toBeInTheDocument()
    );

    switchSemester(SEMESTER);

    // Coming back makes the stored answer valid again — the query really was
    // asked about this semester, so re-running it would return the same ids.
    await waitFor(() =>
      expect(screen.getByText("Machine Learning")).toBeInTheDocument()
    );
    expect(screen.queryByText("Next Term Course")).not.toBeInTheDocument();
  });

  it("clears the box and the keyword filter when the mode changes", () => {
    renderList();

    const input = screen.getByPlaceholderText("Search");
    fireEvent.change(input, { target: { value: "keyword only" } });
    expect(screen.getByLabelText("keyword-filter")).toHaveTextContent(
      "keyword only"
    );

    fireEvent.click(screen.getByRole("button", { name: /smart/i }));

    // Both halves matter: the atom drives the pool, the input drives the user's
    // sense of what is being searched. Leaving either behind shows results for
    // a query the user has moved on from.
    expect(
      screen.getByPlaceholderText("Describe what you want to learn…")
    ).toHaveValue("");
    expect(screen.getByLabelText("keyword-filter")).toHaveTextContent(
      "(empty)"
    );
  });

  it("keeps the keyword filter when the already-active mode is clicked", async () => {
    mockVectorHits();
    renderList(({ set }) => {
      set(selectionOptionsState, (prev) => ({
        ...prev,
        searchTerm: "keyword only",
      }));
      set(smartSearchState, (prev) => ({ ...prev, mode: "smart" }));
    });
    runSmartSearch();

    await waitFor(() =>
      expect(screen.getByText("Machine Learning")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: /smart/i }));

    // Re-clicking the active mode is a "start over" gesture inside that mode:
    // it drops the smart results but must not wipe the keyword filter the user
    // set on the other side of the toggle.
    await waitFor(() =>
      expect(screen.getByLabelText("has-searched")).toHaveTextContent("false")
    );
    expect(screen.queryByText("Machine Learning")).not.toBeInTheDocument();
    expect(screen.getByText("Keyword Only Course")).toBeInTheDocument();
    expect(screen.getByLabelText("keyword-filter")).toHaveTextContent(
      "keyword only"
    );
  });
});
