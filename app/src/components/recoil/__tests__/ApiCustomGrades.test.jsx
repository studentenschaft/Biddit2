/**
 * ApiCustomGrades.test.jsx
 *
 * Contract pins for the custom-grade (what-if) HTTP client. Custom grades are
 * keyed by the course shortName, which can contain "/", spaces and ":" (e.g.
 * "Freier Bereich/Open Area: The Design of Coaching Situations"). DELETE puts
 * that identifier in the URL path, so it MUST be percent-encoded or the "/"
 * splits the path and the backend route 404s. POST puts the same identifier in
 * the JSON body, where it must stay unencoded. These tests pin that asymmetry.
 *
 * The API client wraps axios internally; we mock it at the module boundary so
 * these tests are pure and never touch the network.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();
const mockHandleError = vi.fn();

vi.mock("../../helpers/axiosClient", () => ({
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

const API_URL = "https://api.shsg.ch/course-grades";
const TOKEN = "test-token-xyz";
// The exact shortName that produced a 404 in production: contains "/", " " and ":".
const SLASHED_ID = "Freier Bereich/Open Area: The Design of Coaching Situations";
const ENCODED_ID =
  "Freier%20Bereich%2FOpen%20Area%3A%20The%20Design%20of%20Coaching%20Situations";

describe("ApiCustomGrades", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("deleteCustomGrade", () => {
    it("percent-encodes the identifier in the URL path so a '/' cannot split the route", async () => {
      const { deleteCustomGrade } = await import("../ApiCustomGrades");
      mockDelete.mockResolvedValueOnce({ data: { ok: true } });

      await deleteCustomGrade(TOKEN, SLASHED_ID);

      const [url, token] = mockDelete.mock.calls[0];
      expect(url).toBe(`${API_URL}/${ENCODED_ID}`);
      expect(token).toBe(TOKEN);
      // Regression guard: no raw slash may follow the collection path.
      expect(url.slice(API_URL.length + 1)).not.toContain("/");
    });

    it("returns response.data on success", async () => {
      const { deleteCustomGrade } = await import("../ApiCustomGrades");
      mockDelete.mockResolvedValueOnce({ data: { ok: true } });

      const result = await deleteCustomGrade(TOKEN, "PlainCourse");

      expect(result).toEqual({ ok: true });
    });

    it("reports via errorHandlingService on failure", async () => {
      const { deleteCustomGrade } = await import("../ApiCustomGrades");
      const err = Object.assign(new Error("boom"), {
        response: { status: 404 },
      });
      mockDelete.mockRejectedValueOnce(err);

      await deleteCustomGrade(TOKEN, SLASHED_ID);

      expect(mockHandleError).toHaveBeenCalledWith(err);
    });
  });

  describe("updateCustomGrade", () => {
    it("sends the identifier UNENCODED in the JSON body (not the path)", async () => {
      const { updateCustomGrade } = await import("../ApiCustomGrades");
      mockPost.mockResolvedValueOnce({ data: { ok: true } });

      await updateCustomGrade(TOKEN, SLASHED_ID, 5.75);

      expect(mockPost).toHaveBeenCalledWith(
        API_URL,
        { courseNumber: SLASHED_ID, grade: 5.75 },
        TOKEN
      );
    });

    it("reports via errorHandlingService on failure", async () => {
      const { updateCustomGrade } = await import("../ApiCustomGrades");
      const err = new Error("boom");
      mockPost.mockRejectedValueOnce(err);

      await updateCustomGrade(TOKEN, SLASHED_ID, 5);

      expect(mockHandleError).toHaveBeenCalledWith(err);
    });
  });

  describe("fetchCustomGrades", () => {
    it("GETs the collection with no identifier in the path", async () => {
      const { fetchCustomGrades } = await import("../ApiCustomGrades");
      mockGet.mockResolvedValueOnce({ data: { grades: [] } });

      await fetchCustomGrades(TOKEN);

      expect(mockGet).toHaveBeenCalledWith(API_URL, TOKEN);
    });
  });
});
