// useVectorSearch: the empty/404 → upsert → retry-once sequence shared by
// smart search and Similar Courses.

import { act, renderHook } from "@testing-library/react";
import { RecoilRoot } from "recoil";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "../../../test/mocks/server";
import { authTokenState } from "../../recoil/authAtom";
import { unifiedAcademicDataState } from "../../recoil/unifiedAcademicDataAtom";
import { unifiedCourseDataState } from "../../recoil/unifiedCourseDataAtom";
import { useVectorSearch } from "../useVectorSearch";

const QUERY_URL = "https://api.shsg.ch/similar-courses/query";
const UPSERT_URL = "https://api.shsg.ch/similar-courses/upsert";
const PROGRAM = "Bachelor in Information Systems";

const ML = {
  id: "ml",
  courseNumber: "7,214,1.00",
  shortName: "Machine Learning",
  classification: "Core",
  courseContent: "Supervised learning",
};

const EMPTY = { ids: [[]], distances: [[]], metadatas: [[]] };
const HITS = {
  ids: [[`${ML.courseNumber}HS25`]],
  distances: [[0.2]],
  metadatas: [[{ category: "Core" }]],
};

const semester = (overrides = {}) => ({
  enrolledIds: [],
  available: [ML],
  selectedIds: [],
  studyPlan: [],
  lastFetched: null,
  isFutureSemester: false,
  referenceSemester: null,
  usingReferenceData: false,
  cisId: "cis",
  isCurrent: true,
  isProjected: false,
  ...overrides,
});

const seed =
  ({
    selected = "HS25",
    semesterOverrides = {},
    programs = { [PROGRAM]: {} },
  } = {}) =>
  ({ set }) => {
    set(authTokenState, "test-token");
    set(unifiedAcademicDataState, (prev) => ({ ...prev, programs }));
    set(unifiedCourseDataState, (prev) => ({
      ...prev,
      semesters: { [selected]: semester(semesterOverrides) },
      selectedSemester: selected,
    }));
  };

const renderVectorSearch = (options) =>
  renderHook(() => useVectorSearch(), {
    wrapper: ({ children }) => (
      <RecoilRoot initializeState={seed(options)}>{children}</RecoilRoot>
    ),
  });

/**
 * Serves the given query responses in order (a number is an HTTP status) and
 * records every query and upsert the hook sends.
 */
const mockVectorDb = (...responses) => {
  const calls = { queries: [], upserts: [] };
  server.use(
    http.get(QUERY_URL, ({ request }) => {
      calls.queries.push(Object.fromEntries(new URL(request.url).searchParams));
      const next =
        responses[Math.min(calls.queries.length, responses.length) - 1];
      return typeof next === "number"
        ? new HttpResponse(null, { status: next })
        : HttpResponse.json(next);
    }),
    http.post(UPSERT_URL, async ({ request }) => {
      calls.upserts.push(await request.json());
      return HttpResponse.json({ success: true });
    })
  );
  return calls;
};

const runQuery = async (result) => {
  let hits;
  await act(async () => {
    hits = await result.current.runQuery({
      courseDescription: "machine learning",
    });
  });
  return hits;
};

describe("useVectorSearch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("upserts once and retries once when the first result is empty", async () => {
    const calls = mockVectorDb(EMPTY, HITS);
    const { result } = renderVectorSearch();

    const hits = await runQuery(result);

    expect(calls.upserts).toHaveLength(1);
    expect(calls.upserts[0].courses).toEqual([
      {
        courseNumber: ML.courseNumber,
        semester: "HS25",
        courseDescription: ML.courseContent,
        category: ML.classification,
        program: PROGRAM,
      },
    ]);
    expect(calls.queries).toHaveLength(2);
    expect(hits).toEqual({
      ids: HITS.ids[0],
      distances: HITS.distances[0],
      metadatas: HITS.metadatas[0],
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isUpserting).toBe(false);
  });

  it("upserts once and retries once when the first query answers 404", async () => {
    const calls = mockVectorDb(404, HITS);
    const { result } = renderVectorSearch();

    const hits = await runQuery(result);

    expect(calls.upserts).toHaveLength(1);
    expect(calls.queries).toHaveLength(2);
    expect(hits.ids).toEqual(HITS.ids[0]);
  });

  it("does not upsert again when the retry is empty too", async () => {
    const calls = mockVectorDb(EMPTY, EMPTY);
    const { result } = renderVectorSearch();

    const hits = await runQuery(result);

    expect(calls.upserts).toHaveLength(1);
    expect(calls.queries).toHaveLength(2);
    expect(hits).toEqual({ ids: [], distances: [], metadatas: [] });
  });

  it("queries the reference semester and never upserts borrowed courses", async () => {
    const calls = mockVectorDb(EMPTY, EMPTY);
    const { result } = renderVectorSearch({
      selected: "HS26",
      semesterOverrides: {
        usingReferenceData: true,
        referenceSemester: "HS25",
      },
    });

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await runQuery(result);

    expect(calls.queries.map((q) => q.semester)).toEqual(["HS25", "HS25"]);
    expect(calls.queries[0].program).toBe(PROGRAM);
    expect(calls.upserts).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Upsert skipped: HS26 is showing borrowed")
    );
  });

  it("takes the programme from the scorecards when none is known yet", async () => {
    const calls = mockVectorDb(HITS);
    server.use(
      http.get(
        "https://integration.unisg.ch/StudyApi/MyEnrollments/currentEnrollments",
        () =>
          HttpResponse.json({
            enrollmentInfos: [
              {
                studyProgramDescription: "Master in Banking and Finance",
                studyRegulationId: "42",
                isMainStudy: true,
              },
            ],
          })
      )
    );
    // The enrolment and scorecard loaders log their payloads.
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { result } = renderVectorSearch({ programs: {} });

    const hits = await runQuery(result);

    expect(calls.queries).toHaveLength(1);
    expect(calls.queries[0].program).toBe("Master in Banking and Finance");
    expect(hits.ids).toEqual(HITS.ids[0]);
  });
});
