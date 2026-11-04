/**
 * The exam block and the ExaminationTypes lookup table are filled by two
 * independent requests with no ordering between them. Course Details is not
 * mounted until a course is opened, so both start at the same instant and the
 * course sheet can win — leaving the panel to render exam parts against a
 * lookup table that is still null.
 */

import { act, render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { RecoilRoot, useSetRecoilState } from "recoil";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../../helpers/axiosClient";
import { _resetForTests as resetCourseSheetCache } from "../../helpers/courseSheetCache";
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
  afterEach(() => {
    vi.restoreAllMocks();
    resetCourseSheetCache();
  });

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

/**
 * Switching courses while the first course's sheet is still loading: the late
 * answer for the first course must not replace the second course's sheet.
 */
describe("CourseInfo course switch during a sheet fetch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetCourseSheetCache();
  });

  const SECOND = {
    ...COURSE,
    shortName: "Second Course",
    hsgEntityId: "67890",
    courseNumber: "8,456,1.00",
  };

  it("ignores the superseded course's sheet", async () => {
    let resolveFirstSheet;
    vi.spyOn(apiClient, "get").mockImplementation((url) => {
      const target = String(url);
      if (target.endsWith(`/${COURSE.hsgEntityId}`))
        return new Promise((resolve) => {
          resolveFirstSheet = resolve;
        });
      if (target.endsWith(`/${SECOND.hsgEntityId}`))
        return Promise.resolve({
          data: {
            examinationParts: [
              { examinationTypeId: 1, remark: "Second exam", weightage: 10000 },
            ],
          },
        });
      return Promise.resolve({ data: [] });
    });

    let selectCourse;
    const CourseSelector = () => {
      const setCourseData = useSetRecoilState(unifiedCourseDataState);
      selectCourse = (course) =>
        setCourseData((data) => ({ ...data, selectedCourseInfo: course }));
      return null;
    };

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
        <CourseSelector />
        <Suspense fallback={null}>
          <CourseInfo />
        </Suspense>
      </RecoilRoot>,
    );

    await waitFor(() => expect(resolveFirstSheet).toBeTypeOf("function"));
    act(() => selectCourse(SECOND));
    expect(await screen.findByText("Second exam")).toBeInTheDocument();

    await act(async () => resolveFirstSheet({ data: EXAM_SHEET }));

    expect(screen.getByText("Second exam")).toBeInTheDocument();
    expect(screen.queryByText("Written exam")).not.toBeInTheDocument();
  });
});
