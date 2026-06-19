/**
 * MSW (Mock Service Worker) handlers for API mocking in tests.
 * Supports all endpoints from api.shsg.ch and integration.unisg.ch
 *
 * MSW only activates during test runs, not in dev mode.
 */

import { http, HttpResponse, delay } from "msw";

// Base URLs
const SHSG_API = "https://api.shsg.ch";
const UNISG_API = "https://integration.unisg.ch";

/**
 * Error simulation modes - can be set per-test
 */
export const ErrorSimulation = {
  NONE: "none",
  NETWORK_ERROR: "network_error",
  TIMEOUT: "timeout",
  UNAUTHORIZED_401: "unauthorized_401",
  FORBIDDEN_403: "forbidden_403",
  NOT_FOUND_404: "not_found_404",
  SERVER_ERROR_500: "server_error_500",
  SERVICE_UNAVAILABLE_503: "service_unavailable_503",
};

// Current error simulation mode (controlled by tests)
let currentErrorMode = ErrorSimulation.NONE;
let errorEndpointPattern = null; // null = all endpoints, or regex pattern

/**
 * Set the error simulation mode
 * @param {string} mode - One of ErrorSimulation values
 * @param {RegExp|string|null} endpointPattern - Optional pattern to match specific endpoints
 */
export const setErrorMode = (mode, endpointPattern = null) => {
  currentErrorMode = mode;
  errorEndpointPattern = endpointPattern;
};

/**
 * Reset error simulation to normal mode
 */
export const resetErrorMode = () => {
  currentErrorMode = ErrorSimulation.NONE;
  errorEndpointPattern = null;
};

/**
 * Check if error should be simulated for this URL
 */
const shouldSimulateError = (url) => {
  if (currentErrorMode === ErrorSimulation.NONE) return false;
  if (!errorEndpointPattern) return true;

  if (typeof errorEndpointPattern === "string") {
    return url.includes(errorEndpointPattern);
  }
  return errorEndpointPattern.test(url);
};

/**
 * Apply error simulation if configured
 */
const maybeSimulateError = async (url) => {
  if (!shouldSimulateError(url)) return null;

  switch (currentErrorMode) {
    case ErrorSimulation.NETWORK_ERROR:
      return HttpResponse.error();

    case ErrorSimulation.TIMEOUT:
      // Delay longer than axios timeout (10s)
      await delay(15000);
      return HttpResponse.json({ message: "Request completed" });

    case ErrorSimulation.UNAUTHORIZED_401:
      return HttpResponse.json(
        { message: "Unauthorized - Token expired" },
        { status: 401 },
      );

    case ErrorSimulation.FORBIDDEN_403:
      return HttpResponse.json(
        { message: "Forbidden - Access denied" },
        { status: 403 },
      );

    case ErrorSimulation.NOT_FOUND_404:
      return HttpResponse.json(
        { message: "Resource not found" },
        { status: 404 },
      );

    case ErrorSimulation.SERVER_ERROR_500:
      return HttpResponse.json(
        { message: "Internal server error" },
        { status: 500 },
      );

    case ErrorSimulation.SERVICE_UNAVAILABLE_503:
      return HttpResponse.json(
        { message: "Service temporarily unavailable" },
        { status: 503 },
      );

    default:
      return null;
  }
};

/**
 * Default mock data for various endpoints
 */
const mockData = {
  studyPlans: [
    { id: "FS26", name: "Spring Semester 2026", courses: [] },
    { id: "HS25", name: "Fall Semester 2025", courses: [] },
  ],
  courseRatings: {
    courseId: "8,474,1.00",
    averageRating: 4.2,
    ratings: [],
  },
  scoreCardEnrollments: {
    enrollments: [{ id: 1, status: "enrolled", semester: "FS26" }],
  },
  currentEnrollments: {
    enrollments: [],
  },
  myCourses: [],
  courseInfo: {
    id: "test-course",
    title: "Test Course",
    credits: 6,
  },
  termPhaseInfo: {
    currentTerm: "FS26",
    phases: [],
  },
};

/**
 * SHSG API Handlers (api.shsg.ch)
 */
const shsgHandlers = [
  // GET /study-plans
  http.get(`${SHSG_API}/study-plans`, async ({ request }) => {
    const errorResponse = await maybeSimulateError(request.url);
    if (errorResponse) return errorResponse;

    return HttpResponse.json(mockData.studyPlans);
  }),

  // POST /study-plans/:termId/:courseId
  http.post(
    `${SHSG_API}/study-plans/:termId/:courseId`,
    async ({ request, params }) => {
      const errorResponse = await maybeSimulateError(request.url);
      if (errorResponse) return errorResponse;

      return HttpResponse.json({
        success: true,
        termId: params.termId,
        courseId: params.courseId,
      });
    },
  ),

  // DELETE /study-plans/:termId/:courseId
  http.delete(
    `${SHSG_API}/study-plans/:termId/:courseId`,
    async ({ request }) => {
      const errorResponse = await maybeSimulateError(request.url);
      if (errorResponse) return errorResponse;

      return HttpResponse.json({ success: true });
    },
  ),

  // GET /course-ratings/*
  http.get(`${SHSG_API}/course-ratings/*`, async ({ request }) => {
    const errorResponse = await maybeSimulateError(request.url);
    if (errorResponse) return errorResponse;

    return HttpResponse.json(mockData.courseRatings);
  }),

  // POST /course-ratings/*
  http.post(`${SHSG_API}/course-ratings/*`, async ({ request }) => {
    const errorResponse = await maybeSimulateError(request.url);
    if (errorResponse) return errorResponse;

    return HttpResponse.json({ success: true });
  }),

  // GET /course-grades
  http.get(`${SHSG_API}/course-grades`, async ({ request }) => {
    const errorResponse = await maybeSimulateError(request.url);
    if (errorResponse) return errorResponse;

    return HttpResponse.json({ grades: [] });
  }),

  // POST /similar-courses/upsert
  http.post(`${SHSG_API}/similar-courses/upsert`, async ({ request }) => {
    const errorResponse = await maybeSimulateError(request.url);
    if (errorResponse) return errorResponse;

    return HttpResponse.json({ success: true });
  }),

  // POST /similar-courses/query
  http.post(`${SHSG_API}/similar-courses/query`, async ({ request }) => {
    const errorResponse = await maybeSimulateError(request.url);
    if (errorResponse) return errorResponse;

    return HttpResponse.json({ similarCourses: [] });
  }),

  // GET /scorecard-enrollments/*
  http.get(`${SHSG_API}/scorecard-enrollments/*`, async ({ request }) => {
    const errorResponse = await maybeSimulateError(request.url);
    if (errorResponse) return errorResponse;

    return HttpResponse.json(mockData.scoreCardEnrollments);
  }),
];

/**
 * UniSG Integration API Handlers (integration.unisg.ch)
 */
const unisgHandlers = [
  // GET /EventApi/CourseInformationSheets/*
  http.get(
    `${UNISG_API}/EventApi/CourseInformationSheets/*`,
    async ({ request }) => {
      const errorResponse = await maybeSimulateError(request.url);
      if (errorResponse) return errorResponse;

      await delay(100); // Simulate slight network delay
      return HttpResponse.json(mockData.courseInfo);
    },
  ),

  // GET /EventApi/Events/*
  http.get(`${UNISG_API}/EventApi/Events/*`, async ({ request }) => {
    const errorResponse = await maybeSimulateError(request.url);
    if (errorResponse) return errorResponse;

    return HttpResponse.json({ events: [] });
  }),

  // GET /EventApi/CisTermAndPhaseInformations
  http.get(
    `${UNISG_API}/EventApi/CisTermAndPhaseInformations`,
    async ({ request }) => {
      const errorResponse = await maybeSimulateError(request.url);
      if (errorResponse) return errorResponse;

      return HttpResponse.json(mockData.termPhaseInfo);
    },
  ),

  // GET /EventApi/MyCourses/byTerm/*
  http.get(`${UNISG_API}/EventApi/MyCourses/byTerm/*`, async ({ request }) => {
    const errorResponse = await maybeSimulateError(request.url);
    if (errorResponse) return errorResponse;

    return HttpResponse.json(mockData.myCourses);
  }),

  // GET /AcametaApi/ExaminationTypes
  http.get(`${UNISG_API}/AcametaApi/ExaminationTypes`, async ({ request }) => {
    const errorResponse = await maybeSimulateError(request.url);
    if (errorResponse) return errorResponse;

    return HttpResponse.json({ types: [] });
  }),

  // GET /AchievementApi/MyScoreCards/*
  http.get(
    `${UNISG_API}/AchievementApi/MyScoreCards/*`,
    async ({ request }) => {
      const errorResponse = await maybeSimulateError(request.url);
      if (errorResponse) return errorResponse;

      return HttpResponse.json({ scoreCards: [] });
    },
  ),

  // GET /StudyApi/MyEnrollments/currentEnrollments
  http.get(
    `${UNISG_API}/StudyApi/MyEnrollments/currentEnrollments`,
    async ({ request }) => {
      const errorResponse = await maybeSimulateError(request.url);
      if (errorResponse) return errorResponse;

      return HttpResponse.json(mockData.currentEnrollments);
    },
  ),
];

/**
 * All handlers combined
 */
export const handlers = [...shsgHandlers, ...unisgHandlers];

/**
 * Export mock data for test assertions
 */
export { mockData };
