// One catalog request per cisId at a time, and one reference-fallback rule for
// every caller (course list, curriculum map, academic enrichment).

import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../../../test/mocks/server";
import { apiClient } from "../axiosClient";
import { catalogUrl } from "../apiEndpoints";
import {
  REFERENCE_FALLBACK_MIN_COURSES,
  _resetCatalogLoaderForTests,
  loadCatalogForTerm,
} from "../catalogLoader";

const term = {
  cisId: "cis-1",
  shortName: "HS26",
  referenceCisId: "cis-0",
  referenceSemester: "HS25",
};

const courses = (count, prefix) =>
  Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i}`,
    courseNumber: `${prefix},${i},1.00`,
  }));

const twelveCourses = courses(12, "own");

beforeEach(() => {
  _resetCatalogLoaderForTests();
  // A 500 is retried with a multi-second backoff; fail the retry at once.
  vi.spyOn(apiClient, "retryWithBackoff").mockImplementation((error) =>
    Promise.reject(error)
  );
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadCatalogForTerm", () => {
  it("issues one request for two concurrent loads of the same cisId", async () => {
    let hits = 0;
    server.use(
      http.get(catalogUrl("cis-1"), () => {
        hits++;
        return HttpResponse.json(twelveCourses);
      })
    );

    const [first, second] = await Promise.all([
      loadCatalogForTerm({ term, authToken: "t" }),
      loadCatalogForTerm({ term, authToken: "t" }),
    ]);

    expect(hits).toBe(1);
    expect(first.courses).toHaveLength(12);
    expect(second.courses).toHaveLength(12);
  });

  it("requests again once the earlier load has settled", async () => {
    let hits = 0;
    server.use(
      http.get(catalogUrl("cis-1"), () => {
        hits++;
        return HttpResponse.json(twelveCourses);
      })
    );

    await loadCatalogForTerm({ term, authToken: "t" });
    await loadCatalogForTerm({ term, authToken: "t" });

    expect(hits).toBe(2);
  });

  it("returns the term's own catalog when it is not sparse", async () => {
    server.use(
      http.get(catalogUrl("cis-1"), () => HttpResponse.json(twelveCourses))
    );

    const result = await loadCatalogForTerm({ term, authToken: "t" });

    expect(result).toEqual({
      courses: twelveCourses,
      usingReferenceData: false,
      referenceSemester: null,
      source: "primary",
    });
  });

  it("falls back to the reference term when the primary is sparse", async () => {
    const reference = courses(12, "ref");
    server.use(
      http.get(catalogUrl("cis-1"), () =>
        HttpResponse.json(courses(REFERENCE_FALLBACK_MIN_COURSES - 1, "own"))
      ),
      http.get(catalogUrl("cis-0"), () => HttpResponse.json(reference))
    );

    const result = await loadCatalogForTerm({ term, authToken: "t" });

    expect(result).toEqual({
      courses: reference,
      usingReferenceData: true,
      referenceSemester: "HS25",
      source: "reference",
    });
  });

  it("keeps the sparse primary when the reference fails", async () => {
    const sparse = courses(3, "own");
    server.use(
      http.get(catalogUrl("cis-1"), () => HttpResponse.json(sparse)),
      http.get(catalogUrl("cis-0"), () =>
        HttpResponse.json({ message: "boom" }, { status: 500 })
      )
    );

    const result = await loadCatalogForTerm({ term, authToken: "t" });

    expect(result.source).toBe("primary");
    expect(result.courses).toEqual(sparse);
    expect(result.usingReferenceData).toBe(false);
  });

  it("falls back to the reference term when the primary fails", async () => {
    const reference = courses(12, "ref");
    server.use(
      http.get(catalogUrl("cis-1"), () =>
        HttpResponse.json({ message: "boom" }, { status: 500 })
      ),
      http.get(catalogUrl("cis-0"), () => HttpResponse.json(reference))
    );

    const result = await loadCatalogForTerm({ term, authToken: "t" });

    expect(result.source).toBe("reference");
    expect(result.courses).toEqual(reference);
  });

  it("returns source none with the error when primary fails and there is no reference", async () => {
    server.use(
      http.get(catalogUrl("cis-1"), () =>
        HttpResponse.json({ message: "boom" }, { status: 500 })
      )
    );

    const result = await loadCatalogForTerm({
      term: { cisId: "cis-1", shortName: "HS26" },
      authToken: "t",
    });

    expect(result.source).toBe("none");
    expect(result.courses).toEqual([]);
    expect(result.usingReferenceData).toBe(false);
    expect(result.error?.response?.status).toBe(500);
  });
});
