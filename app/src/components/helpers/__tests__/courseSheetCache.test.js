// Course sheets and per-course ratings are fetched once per course per session:
// Course Details remounts on every tab visit and re-selecting a course must not
// download its sheet or ratings again.

import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../../../test/mocks/server";
import { apiClient } from "../axiosClient";
import {
  _resetForTests,
  forgetCourseRatings,
  getCourseRatings,
  getCourseSheet,
} from "../courseSheetCache";

const SHEETS = "https://integration.unisg.ch/EventApi/CourseInformationSheets/latestPublishedByHsgEntityId";
const RATINGS = "https://api.shsg.ch/course-ratings/by-course";

const COURSE = { hsgEntityId: "12345", courseNumber: "8,123,1.00" };
const SHEET = { examinationParts: [{ examinationTypeId: 1, weightage: 10000 }] };
const RATING = { courseNumber: "8,123,1.00", avgRatings: {}, nbOfRatings: 3 };

beforeEach(() => {
  _resetForTests();
  // A 500 is retried with a multi-second backoff; fail the retry at once.
  vi.spyOn(apiClient, "retryWithBackoff").mockImplementation((error) =>
    Promise.reject(error)
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getCourseSheet", () => {
  it("requests a course's sheet once for two sequential calls", async () => {
    let hits = 0;
    server.use(
      http.get(`${SHEETS}/:id`, () => {
        hits++;
        return HttpResponse.json(SHEET);
      })
    );

    await getCourseSheet({ course: COURSE, authToken: "t" });
    const second = await getCourseSheet({ course: COURSE, authToken: "t" });

    expect(hits).toBe(1);
    expect(second).toEqual(SHEET);
  });

  it("shares one request between two concurrent calls", async () => {
    let hits = 0;
    server.use(
      http.get(`${SHEETS}/:id`, () => {
        hits++;
        return HttpResponse.json(SHEET);
      })
    );

    await Promise.all([
      getCourseSheet({ course: COURSE, authToken: "t" }),
      getCourseSheet({ course: COURSE, authToken: "t" }),
    ]);

    expect(hits).toBe(1);
  });

  it("caches two offerings of one course number separately", async () => {
    const requested = [];
    server.use(
      http.get(`${SHEETS}/:id`, ({ params }) => {
        requested.push(params.id);
        return HttpResponse.json({ sheetOf: params.id });
      })
    );
    const otherOffering = { ...COURSE, hsgEntityId: "67890" };

    const first = await getCourseSheet({ course: COURSE, authToken: "t" });
    const second = await getCourseSheet({ course: otherOffering, authToken: "t" });

    expect(requested).toEqual(["12345", "67890"]);
    expect(first).toEqual({ sheetOf: "12345" });
    expect(second).toEqual({ sheetOf: "67890" });
  });

  it("does not cache a course without any identifier", async () => {
    let hits = 0;
    server.use(
      http.get(`${SHEETS}/:id`, () => {
        hits++;
        return HttpResponse.json(SHEET);
      })
    );

    await getCourseSheet({ course: { shortName: "A" }, authToken: "t" });
    await getCourseSheet({ course: { shortName: "B" }, authToken: "t" });

    expect(hits).toBe(2);
  });

  it("falls back to the course-number lookup when the entity lookup fails", async () => {
    const requested = [];
    server.use(
      http.get(`${SHEETS}/:id`, ({ params }) => {
        requested.push(params.id);
        return params.id === COURSE.hsgEntityId
          ? HttpResponse.json({ message: "boom" }, { status: 404 })
          : HttpResponse.json(SHEET);
      })
    );

    const sheet = await getCourseSheet({ course: COURSE, authToken: "t" });

    expect(sheet).toEqual(SHEET);
    expect(requested).toEqual([COURSE.hsgEntityId, COURSE.courseNumber]);
  });

  it("does not cache a failed fetch: the next call requests again", async () => {
    let hits = 0;
    server.use(
      http.get(`${SHEETS}/:id`, () => {
        hits++;
        // Both lookups of the first call fail; the next call succeeds.
        return hits <= 2
          ? HttpResponse.json({ message: "boom" }, { status: 500 })
          : HttpResponse.json(SHEET);
      })
    );

    await expect(
      getCourseSheet({ course: COURSE, authToken: "t" })
    ).rejects.toMatchObject({ response: { status: 500 } });
    const retried = await getCourseSheet({ course: COURSE, authToken: "t" });

    expect(retried).toEqual(SHEET);
    expect(hits).toBe(3);
  });
});

describe("getCourseRatings", () => {
  it("requests a course's ratings once for two sequential calls", async () => {
    let hits = 0;
    server.use(
      http.get(`${RATINGS}/:courseNumber`, () => {
        hits++;
        return HttpResponse.json([RATING]);
      })
    );

    await getCourseRatings({ courseNumber: COURSE.courseNumber, authToken: "t" });
    const second = await getCourseRatings({
      courseNumber: COURSE.courseNumber,
      authToken: "t",
    });

    expect(hits).toBe(1);
    expect(second).toEqual([RATING]);
  });

  it("does not cache a failed fetch: the next call requests again", async () => {
    let hits = 0;
    server.use(
      http.get(`${RATINGS}/:courseNumber`, () => {
        hits++;
        return hits === 1
          ? HttpResponse.json({ message: "boom" }, { status: 500 })
          : HttpResponse.json([RATING]);
      })
    );

    await expect(
      getCourseRatings({ courseNumber: COURSE.courseNumber, authToken: "t" })
    ).rejects.toMatchObject({ response: { status: 500 } });
    const retried = await getCourseRatings({
      courseNumber: COURSE.courseNumber,
      authToken: "t",
    });

    expect(retried).toEqual([RATING]);
    expect(hits).toBe(2);
  });

  it("requests again after the course's ratings were forgotten", async () => {
    let hits = 0;
    server.use(
      http.get(`${RATINGS}/:courseNumber`, () => {
        hits++;
        return HttpResponse.json([RATING]);
      })
    );

    await getCourseRatings({ courseNumber: COURSE.courseNumber, authToken: "t" });
    forgetCourseRatings(COURSE.courseNumber);
    await getCourseRatings({ courseNumber: COURSE.courseNumber, authToken: "t" });

    expect(hits).toBe(2);
  });

  it("drops the rating entry that was requested to be removed", async () => {
    server.use(
      http.get(`${RATINGS}/:courseNumber`, () =>
        HttpResponse.json([{ ...RATING, courseNumber: "7,721,1.00" }])
      )
    );

    const ratings = await getCourseRatings({
      courseNumber: "7,721,1.00",
      authToken: "t",
    });

    expect(ratings).toEqual([]);
  });
});
