/**
 * The exam plan loads itself: the first read of `examPlanState(semester)` in a
 * store fetches the static artifact once, and every outcome ends in an
 * explicit status. "none" is the ordinary answer for a semester that was never
 * ingested and stays quiet; "error" means something is there but cannot be
 * trusted, and warns. Borrowed catalogs are refused by `examPlanSelector`
 * before the atom is read, so they never cause a request.
 */

import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import PropTypes from "prop-types";
import { RecoilRoot, useRecoilValue } from "recoil";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockData } from "../../../test/mocks/handlers";
import { server } from "../../../test/mocks/server";
import { examPlanState } from "../examScheduleAtom";
import { examPlanSelector } from "../examScheduleSelectors";
import { unifiedCourseDataState } from "../unifiedCourseDataAtom";

const NO_PLAN = { status: "none", plan: null };
const INDEX_HTML = "<!DOCTYPE html><html><body>SPA fallback</body></html>";

let fetchSpy;
let warnSpy;

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, "fetch");
  // Silenced so the expected warnings stay out of the output; every test
  // asserts on it instead.
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

const examRequests = () =>
  fetchSpy.mock.calls.filter(([url]) => String(url).includes("/exams/"))
    .length;

/** Reads the plan for a semester the way the surfaces do. */
const readPlan = (semester, semesterData, seededPlan) => {
  const wrapper = ({ children }) => (
    <RecoilRoot
      initializeState={({ set }) => {
        if (semesterData) {
          set(unifiedCourseDataState, (previous) => ({
            ...previous,
            semesters: { [semester]: semesterData },
          }));
        }
        if (seededPlan) set(examPlanState(semester), seededPlan);
      }}
    >
      {children}
    </RecoilRoot>
  );
  return renderHook(() => useRecoilValue(examPlanSelector(semester)), {
    wrapper,
  }).result;
};

const serveHS26 = (resolver) =>
  server.use(http.get("*/exams/HS26.json", resolver));

describe("examPlanState", () => {
  it("loads an ingested semester's plan", async () => {
    const result = readPlan("HS26");

    expect(result.current).toEqual({ status: "loading", plan: null });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.plan).toEqual(mockData.examSchedule);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it.each(["application/json", "application/json; charset=utf-8"])(
    "accepts a plan served as %s",
    async (contentType) => {
      serveHS26(
        () =>
          new HttpResponse(JSON.stringify(mockData.examSchedule), {
            headers: { "Content-Type": contentType },
          }),
      );
      const result = readPlan("HS26");

      await waitFor(() => expect(result.current.status).toBe("ready"));
    },
  );

  it("reads the SPA fallback's index.html as no plan, quietly", async () => {
    // The default handler answers FS26 the way the Vite dev server does: 200
    // with index.html.
    const result = readPlan("FS26");

    await waitFor(() => expect(result.current).toEqual(NO_PLAN));
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("reads a 404 as no plan, quietly", async () => {
    // Netlify's `/exams/*  /index.html  404` rule.
    serveHS26(() => HttpResponse.html(INDEX_HTML, { status: 404 }));
    const result = readPlan("HS26");

    await waitFor(() => expect(result.current).toEqual(NO_PLAN));
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("flags a JSON response that does not parse and warns", async () => {
    serveHS26(
      () =>
        new HttpResponse('{"schemaVersion": 2, "written": [', {
          headers: { "Content-Type": "application/json" },
        }),
    );
    const result = readPlan("HS26");

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.plan).toBeNull();
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it.each([
    // Schema 1 dated oral exams with a single day that was really a range.
    ["a schemaVersion it does not read", { schemaVersion: 1 }],
    ["a plan without written exams", { written: undefined }],
    ["a plan whose oral exams are not a list", { oral: {} }],
  ])("flags %s and warns", async (_, override) => {
    serveHS26(() => HttpResponse.json({ ...mockData.examSchedule, ...override }));
    const result = readPlan("HS26");

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.plan).toBeNull();
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("flags an unreachable artifact and warns", async () => {
    serveHS26(() => HttpResponse.error());
    const result = readPlan("HS26");

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("never requests or shows a plan for a borrowed catalog or no semester", () => {
    for (const [metadata, seededPlan] of [
      [{ isFutureSemester: true, referenceSemester: "HS25" }],
      [{ usingReferenceData: true, referenceSemester: "HS25" }],
      // The plan can finish loading before the catalog turns out borrowed.
      [
        { usingReferenceData: true, referenceSemester: "HS25" },
        { status: "ready", plan: mockData.examSchedule },
      ],
    ]) {
      expect(
        readPlan("HS26", { cisId: "1", ...metadata }, seededPlan).current,
      ).toEqual(NO_PLAN);
    }
    expect(readPlan(null).current).toEqual(NO_PLAN);

    expect(examRequests()).toBe(0);
  });

  it("requests a semester once, however many surfaces read it", async () => {
    const PlanStatus = ({ semester }) => (
      <span data-testid="status">
        {useRecoilValue(examPlanSelector(semester)).status}
      </span>
    );
    PlanStatus.propTypes = { semester: PropTypes.string };

    const { rerender } = render(
      <RecoilRoot>
        <PlanStatus semester="HS26" />
        <PlanStatus semester="HS26" />
      </RecoilRoot>,
    );
    await waitFor(() =>
      expect(screen.getAllByText("ready")).toHaveLength(2),
    );

    // Course Details unmounts and comes back on every tab switch.
    rerender(<RecoilRoot>{null}</RecoilRoot>);
    rerender(
      <RecoilRoot>
        <PlanStatus semester="HS26" />
      </RecoilRoot>,
    );

    expect(screen.getByTestId("status")).toHaveTextContent("ready");
    expect(examRequests()).toBe(1);
  });

  it("keeps a plan seeded into the store instead of requesting it", () => {
    const seeded = { status: "ready", plan: mockData.examSchedule };
    const wrapper = ({ children }) => (
      <RecoilRoot
        initializeState={({ set }) => set(examPlanState("HS26"), seeded)}
      >
        {children}
      </RecoilRoot>
    );

    const { result } = renderHook(
      () => useRecoilValue(examPlanSelector("HS26")),
      { wrapper },
    );

    expect(result.current).toEqual(seeded);
    expect(examRequests()).toBe(0);
  });
});
