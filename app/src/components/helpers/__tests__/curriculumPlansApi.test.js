/**
 * curriculumPlansApi.test.js
 *
 * Contract pins for the curriculum-plans HTTP client. These tests assert the
 * exact URL, HTTP verb, payload shape, and token propagation for every call
 * the backend exposes. They would fail immediately if a future edit:
 *   - points BASE_URL at localhost or any non-prod host,
 *   - switches a verb (e.g. POST -> PUT),
 *   - reshapes a request body,
 *   - or stops forwarding the auth token.
 *
 * The API client wraps axios internally; we mock it at the module boundary
 * so these tests are pure and never touch the network.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();
const mockHandleError = vi.fn();

vi.mock("../axiosClient", () => ({
  apiClient: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    delete: (...args) => mockDelete(...args),
  },
}));

vi.mock("../../errorHandling/ErrorHandlingService", () => ({
  errorHandlingService: {
    handleError: (...args) => mockHandleError(...args),
  },
}));

const PROD_BASE = "https://api.shsg.ch/curriculum-plans";
const TOKEN = "test-token-xyz";

describe("curriculumPlansApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("BASE_URL", () => {
    it("targets the production SHSG API (catches localhost regressions)", async () => {
      const { getCurriculumPlans } = await import("../curriculumPlansApi");
      mockGet.mockResolvedValueOnce({ data: {} });

      await getCurriculumPlans(TOKEN);

      const [url] = mockGet.mock.calls[0];
      expect(url).toBe(PROD_BASE);
      expect(url).not.toMatch(/localhost/);
    });
  });

  describe("getCurriculumPlans", () => {
    it("GETs the collection with the token and returns response.data", async () => {
      const { getCurriculumPlans } = await import("../curriculumPlansApi");
      const body = { activePlanId: "plan-default", plans: {} };
      mockGet.mockResolvedValueOnce({ data: body });

      const result = await getCurriculumPlans(TOKEN);

      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(mockGet).toHaveBeenCalledWith(PROD_BASE, TOKEN);
      expect(result).toBe(body);
    });

    it("reports via errorHandlingService and rethrows on failure", async () => {
      const { getCurriculumPlans } = await import("../curriculumPlansApi");
      const err = Object.assign(new Error("boom"), {
        response: { status: 500 },
      });
      mockGet.mockRejectedValueOnce(err);

      await expect(getCurriculumPlans(TOKEN)).rejects.toBe(err);
      expect(mockHandleError).toHaveBeenCalledWith(err);
    });

    it("does NOT special-case 404 (backend auto-creates default plan)", async () => {
      // Previously a 404 was translated to null ("new user"); backend now
      // always returns a populated response, so a 404 must propagate.
      const { getCurriculumPlans } = await import("../curriculumPlansApi");
      const err = Object.assign(new Error("not found"), {
        response: { status: 404 },
      });
      mockGet.mockRejectedValueOnce(err);

      await expect(getCurriculumPlans(TOKEN)).rejects.toBe(err);
    });
  });

  describe("setActivePlanApi", () => {
    it("POSTs /active/:planId with empty body and token", async () => {
      const { setActivePlanApi } = await import("../curriculumPlansApi");
      mockPost.mockResolvedValueOnce({ data: { ok: true } });

      const result = await setActivePlanApi("plan-42", TOKEN);

      expect(mockPost).toHaveBeenCalledWith(
        `${PROD_BASE}/active/plan-42`,
        {},
        TOKEN,
      );
      expect(result).toEqual({ ok: true });
    });

    it("reports and rethrows on failure", async () => {
      const { setActivePlanApi } = await import("../curriculumPlansApi");
      const err = new Error("nope");
      mockPost.mockRejectedValueOnce(err);

      await expect(setActivePlanApi("plan-42", TOKEN)).rejects.toBe(err);
      expect(mockHandleError).toHaveBeenCalledWith(err);
    });
  });

  describe("upsertPlan", () => {
    it("POSTs /:planId with the given data and token", async () => {
      const { upsertPlan } = await import("../curriculumPlansApi");
      const payload = { name: "My Plan", placements: [] };
      mockPost.mockResolvedValueOnce({ data: { ok: true } });

      await upsertPlan("plan-42", payload, TOKEN);

      expect(mockPost).toHaveBeenCalledWith(
        `${PROD_BASE}/plan-42`,
        payload,
        TOKEN,
      );
    });

    it("reports and rethrows on failure", async () => {
      const { upsertPlan } = await import("../curriculumPlansApi");
      const err = new Error("fail");
      mockPost.mockRejectedValueOnce(err);

      await expect(upsertPlan("plan-42", {}, TOKEN)).rejects.toBe(err);
      expect(mockHandleError).toHaveBeenCalledWith(err);
    });
  });

  describe("deletePlanApi", () => {
    it("DELETEs /:planId with token", async () => {
      const { deletePlanApi } = await import("../curriculumPlansApi");
      mockDelete.mockResolvedValueOnce({ data: { ok: true } });

      await deletePlanApi("plan-42", TOKEN);

      expect(mockDelete).toHaveBeenCalledWith(`${PROD_BASE}/plan-42`, TOKEN);
    });

    it("reports and rethrows on failure", async () => {
      const { deletePlanApi } = await import("../curriculumPlansApi");
      const err = new Error("fail");
      mockDelete.mockRejectedValueOnce(err);

      await expect(deletePlanApi("plan-42", TOKEN)).rejects.toBe(err);
      expect(mockHandleError).toHaveBeenCalledWith(err);
    });
  });

  describe("duplicatePlanApi", () => {
    it("POSTs /:planId/duplicate with { name } body", async () => {
      const { duplicatePlanApi } = await import("../curriculumPlansApi");
      mockPost.mockResolvedValueOnce({ data: { ok: true } });

      await duplicatePlanApi("plan-42", "My Copy", TOKEN);

      expect(mockPost).toHaveBeenCalledWith(
        `${PROD_BASE}/plan-42/duplicate`,
        { name: "My Copy" },
        TOKEN,
      );
    });

    it("reports and rethrows on failure", async () => {
      const { duplicatePlanApi } = await import("../curriculumPlansApi");
      const err = new Error("fail");
      mockPost.mockRejectedValueOnce(err);

      await expect(duplicatePlanApi("p", "n", TOKEN)).rejects.toBe(err);
      expect(mockHandleError).toHaveBeenCalledWith(err);
    });
  });

  describe("upsertPlacement", () => {
    it("POSTs /:planId/:placementId with placement payload", async () => {
      const { upsertPlacement } = await import("../curriculumPlansApi");
      const data = {
        type: "course",
        semester: "FS26",
        categoryPath: "Core",
        courseId: "ABC123",
      };
      mockPost.mockResolvedValueOnce({ data: { ok: true } });

      await upsertPlacement("plan-42", "course-ABC123", data, TOKEN);

      expect(mockPost).toHaveBeenCalledWith(
        `${PROD_BASE}/plan-42/course-ABC123`,
        data,
        TOKEN,
      );
    });

    it("reports and rethrows on failure", async () => {
      const { upsertPlacement } = await import("../curriculumPlansApi");
      const err = new Error("fail");
      mockPost.mockRejectedValueOnce(err);

      await expect(upsertPlacement("p", "pl", {}, TOKEN)).rejects.toBe(err);
      expect(mockHandleError).toHaveBeenCalledWith(err);
    });
  });

  describe("removePlacement", () => {
    it("DELETEs /:planId/:placementId with token", async () => {
      const { removePlacement } = await import("../curriculumPlansApi");
      mockDelete.mockResolvedValueOnce({ data: { ok: true } });

      await removePlacement("plan-42", "course-ABC123", TOKEN);

      expect(mockDelete).toHaveBeenCalledWith(
        `${PROD_BASE}/plan-42/course-ABC123`,
        TOKEN,
      );
    });

    it("reports and rethrows on failure", async () => {
      const { removePlacement } = await import("../curriculumPlansApi");
      const err = new Error("fail");
      mockDelete.mockRejectedValueOnce(err);

      await expect(removePlacement("p", "pl", TOKEN)).rejects.toBe(err);
      expect(mockHandleError).toHaveBeenCalledWith(err);
    });
  });

  describe("setSemesterNoteApi", () => {
    it("POSTs /:planId/semester-notes/:semesterKey with { note } body", async () => {
      const { setSemesterNoteApi } = await import("../curriculumPlansApi");
      mockPost.mockResolvedValueOnce({ data: { ok: true } });

      await setSemesterNoteApi("plan-42", "FS26", "retake", TOKEN);

      expect(mockPost).toHaveBeenCalledWith(
        `${PROD_BASE}/plan-42/semester-notes/FS26`,
        { note: "retake" },
        TOKEN,
      );
    });

    it("forwards null to clear the note", async () => {
      const { setSemesterNoteApi } = await import("../curriculumPlansApi");
      mockPost.mockResolvedValueOnce({ data: { ok: true } });

      await setSemesterNoteApi("plan-42", "FS26", null, TOKEN);

      expect(mockPost).toHaveBeenCalledWith(
        `${PROD_BASE}/plan-42/semester-notes/FS26`,
        { note: null },
        TOKEN,
      );
    });

    it("reports and rethrows on failure", async () => {
      const { setSemesterNoteApi } = await import("../curriculumPlansApi");
      const err = new Error("fail");
      mockPost.mockRejectedValueOnce(err);

      await expect(
        setSemesterNoteApi("p", "FS26", "x", TOKEN),
      ).rejects.toBe(err);
      expect(mockHandleError).toHaveBeenCalledWith(err);
    });
  });
});
