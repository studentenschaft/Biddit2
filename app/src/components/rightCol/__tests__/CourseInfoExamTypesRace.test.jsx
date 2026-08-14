/**
 * The exam block and the ExaminationTypes lookup table are filled by two
 * independent requests with no ordering between them. Course Details is not
 * mounted until a course is opened, so both start at the same instant and the
 * course sheet can win — leaving the panel to render exam parts against a
 * lookup table that is still null.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { RecoilRoot } from "recoil";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../../helpers/axiosClient";
import { authTokenState } from "../../recoil/authAtom";
import { unifiedCourseDataState } from "../../recoil/unifiedCourseDataAtom";
import CourseInfo from "../CourseInfo";

const COURSE = {
  shortName: "Advanced Cybersecurity",
  hsgEntityId: "12345",
  courseNumber: "8,123,1.00",
  credits: 600,
  classification: "Core Elective",
  achievementFormStatus: {
    isCentral: true,
    isDeCentral: false,
    description: "Central",
  },
  lecturers: [{ displayName: "Prof. Dr. Example" }],
  learningObjectives: "<p>Objectives</p>",
  courseContent: "<p>Content</p>",
  coursePrerequisites: "<p>Prerequisites</p>",
  courseStructure: "<p>Structure</p>",
  courseLiterature: "<p>Literature</p>",
  courseAdditionalInformation: "<p>Additional</p>",
};

const EXAM_SHEET = {
  examinationParts: [
    { examinationTypeId: 2217, remark: "Written exam", weightage: 5000 },
  ],
};

/**
 * ExaminationTypes is left pending for the whole test, so the lookup table
 * stays at its null default while the course sheet resolves — the exact
 * ordering the user hit.
 */
const mockApiWithPendingExaminationTypes = () =>
  vi.spyOn(apiClient, "get").mockImplementation((url) => {
    const target = String(url);
    if (target.includes("ExaminationTypes")) return new Promise(() => {});
    if (target.includes("CourseInformationSheets"))
      return Promise.resolve({ data: EXAM_SHEET });
    return Promise.resolve({ data: [] });
  });

const renderWithSelectedCourse = () =>
  render(
    <RecoilRoot
      initializeState={({ set }) => {
        set(authTokenState, "token");
        set(unifiedCourseDataState, {
          semesters: {},
          selectedSemester: null,
          latestValidTerm: null,
          selectedCourseInfo: COURSE,
        });
      }}
    >
      <Suspense fallback={null}>
        <CourseInfo />
      </Suspense>
    </RecoilRoot>,
  );

describe("CourseInfo with a selected course", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders exam parts without crashing while ExaminationTypes is still loading", async () => {
    mockApiWithPendingExaminationTypes();

    renderWithSelectedCourse();

    // The exam part rendering is the crash path — wait until it has run.
    expect(await screen.findByText("Written exam")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();

    // The panel must survive it.
    expect(screen.getByText(COURSE.shortName)).toBeInTheDocument();
  });

  it("keeps the panel mounted when a course has an unknown examination type id", async () => {
    vi.spyOn(apiClient, "get").mockImplementation((url) => {
      const target = String(url);
      if (target.includes("ExaminationTypes"))
        return Promise.resolve({
          data: [{ id: 1, shortName: "MC", description: "Multiple choice" }],
        });
      if (target.includes("CourseInformationSheets"))
        return Promise.resolve({ data: EXAM_SHEET });
      return Promise.resolve({ data: [] });
    });

    renderWithSelectedCourse();

    expect(await screen.findByText("Written exam")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(COURSE.shortName)).toBeInTheDocument(),
    );
  });
});
