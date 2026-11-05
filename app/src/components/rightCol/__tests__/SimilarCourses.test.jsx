// Similar Courses runs its search through useVectorSearch: the embedding
// notice covers the one-off upsert, then the retried results render.

import { fireEvent, render, screen } from "@testing-library/react";
import { RecoilRoot } from "recoil";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../../test/mocks/server";
import { authTokenState } from "../../recoil/authAtom";
import { unifiedAcademicDataState } from "../../recoil/unifiedAcademicDataAtom";
import { unifiedCourseDataState } from "../../recoil/unifiedCourseDataAtom";
import SimilarCourses from "../SimilarCourses";

const SELECTED = {
  id: "ml",
  courseNumber: "7,214,1.00",
  shortName: "Machine Learning",
  classification: "Core",
  credits: 400,
  courseContent: "Supervised learning",
};
const MATCH = {
  id: "dv",
  courseNumber: "8,180,1.00",
  shortName: "Data Visualisation",
  classification: "Elective",
  credits: 400,
  courseContent: "Charts",
};

const seed = ({ set }) => {
  set(authTokenState, "test-token");
  set(unifiedAcademicDataState, (prev) => ({
    ...prev,
    programs: { "Bachelor in Information Systems": {} },
  }));
  set(unifiedCourseDataState, (prev) => ({
    ...prev,
    semesters: {
      HS25: {
        enrolledIds: [],
        available: [SELECTED, MATCH],
        selectedIds: [],
        studyPlan: [],
        lastFetched: null,
        isFutureSemester: false,
        referenceSemester: null,
        usingReferenceData: false,
        cisId: "cis-hs25",
        isCurrent: true,
        isProjected: false,
      },
    },
    selectedSemester: "HS25",
  }));
};

describe("SimilarCourses", () => {
  it("shows the embedding notice during the upsert, then the retried results", async () => {
    let queries = 0;
    let finishUpsert;
    server.use(
      http.get("https://api.shsg.ch/similar-courses/query", () => {
        queries += 1;
        return HttpResponse.json(
          queries === 1
            ? { ids: [[]], distances: [[]], metadatas: [[]] }
            : {
                ids: [[`${MATCH.courseNumber}HS25`]],
                distances: [[0.3]],
                metadatas: [[{}]],
              }
        );
      }),
      http.post(
        "https://api.shsg.ch/similar-courses/upsert",
        () =>
          new Promise((resolve) => {
            finishUpsert = () => resolve(HttpResponse.json({ success: true }));
          })
      )
    );

    render(
      <RecoilRoot initializeState={seed}>
        <SimilarCourses selectedCourse={SELECTED} />
      </RecoilRoot>
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Search for similar courses" })
    );

    expect(
      await screen.findByText(/Embedding your course descriptions/)
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Loading similar courses...")
    ).not.toBeInTheDocument();

    finishUpsert();

    expect(await screen.findByText("Data Visualisation")).toBeInTheDocument();
    expect(
      screen.queryByText(/Embedding your course descriptions/)
    ).not.toBeInTheDocument();
    expect(queries).toBe(2);
  });
});
