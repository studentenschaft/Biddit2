/**
 * The exam plan is a static per-semester asset. Course Details remounts on
 * every tab visit, so without the atom guard it would be refetched each time —
 * and every failure mode has to end as "missing", never as an error.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import PropTypes from "prop-types";
import { RecoilRoot } from "recoil";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "../../../test/mocks/server";
import { useExamSchedule } from "../useExamSchedule";

const Probe = ({ semester }) => {
  const schedule = useExamSchedule(semester);
  const status = schedule ? (schedule.plan ? "loaded" : "missing") : "pending";
  return <span data-testid="status">{status}</span>;
};

Probe.propTypes = { semester: PropTypes.string };

const examFetchCount = (spy) =>
  spy.mock.calls.filter(([url]) => String(url).includes("/exams/")).length;

describe("useExamSchedule", () => {
  afterEach(() => vi.restoreAllMocks());

  it("fetches an ingested semester once and survives a remount", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const { rerender } = render(
      <RecoilRoot>
        <Probe semester="HS26" />
      </RecoilRoot>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("loaded"),
    );

    // Tab switch: the panel unmounts and comes back.
    rerender(<RecoilRoot>{null}</RecoilRoot>);
    rerender(
      <RecoilRoot>
        <Probe semester="HS26" />
      </RecoilRoot>,
    );

    expect(screen.getByTestId("status")).toHaveTextContent("loaded");
    expect(examFetchCount(fetchSpy)).toBe(1);
  });

  it("treats a semester without an artifact as missing", async () => {
    render(
      <RecoilRoot>
        <Probe semester="FS26" />
      </RecoilRoot>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("missing"),
    );
  });

  it("treats an unknown schemaVersion as missing", async () => {
    server.use(
      http.get("*/exams/HS26.json", () =>
        HttpResponse.json({ schemaVersion: 99, written: [], oral: [] }),
      ),
    );

    render(
      <RecoilRoot>
        <Probe semester="HS26" />
      </RecoilRoot>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("missing"),
    );
  });

  it("treats an unreachable artifact as missing", async () => {
    server.use(http.get("*/exams/HS26.json", () => HttpResponse.error()));

    render(
      <RecoilRoot>
        <Probe semester="HS26" />
      </RecoilRoot>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("missing"),
    );
  });

  it("does not fetch without a semester", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(
      <RecoilRoot>
        <Probe semester={null} />
      </RecoilRoot>,
    );

    expect(screen.getByTestId("status")).toHaveTextContent("pending");
    expect(examFetchCount(fetchSpy)).toBe(0);
  });
});
