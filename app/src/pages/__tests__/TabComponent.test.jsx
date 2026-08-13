/**
 * Alignment guard for the tab row: the rendered tabs must match TAB_ORDER
 * exactly, in order. Panel children are stubbed so the assertion is about the
 * tab row only and cannot be broken by panel data fetching.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecoilRoot } from "recoil";
import { TAB, TAB_LABELS, TAB_ORDER } from "../../constants/tabs";
import { unifiedCourseDataState } from "../../components/recoil/unifiedCourseDataAtom";
import TabComponent from "../TabComponent";

vi.mock("../../components/rightCol/CourseInfo", () => ({
  default: () => <div>course-info-stub</div>,
}));
vi.mock("../../components/rightCol/Calendar", () => ({
  default: () => <div>calendar-stub</div>,
}));
vi.mock("../../components/rightCol/SemesterSummary", () => ({
  default: () => <div>summary-stub</div>,
}));
vi.mock("../../components/rightCol/Transcript", () => ({
  default: () => <div>transcript-stub</div>,
}));
vi.mock("../../components/rightCol/CurriculumMap", () => ({
  default: () => <div>curriculum-map-stub</div>,
}));

const renderTabs = (initializeState) =>
  render(
    <RecoilRoot initializeState={initializeState}>
      <TabComponent selectedTab={0} onTabSelect={() => {}} />
    </RecoilRoot>,
  );

const tabNames = () =>
  screen.getAllByRole("tab").map((tab) => tab.textContent.trim());

describe("TabComponent tab row", () => {
  it("renders one tab per TAB_ORDER entry, in order", () => {
    renderTabs();
    const names = tabNames();
    expect(names).toHaveLength(TAB_ORDER.length);
    expect(names).toEqual(TAB_ORDER.map((tabId) => TAB_LABELS[tabId]));
  });

  it("uses the selected semester for the summary tab label", () => {
    renderTabs(({ set }) =>
      set(unifiedCourseDataState, {
        semesters: {},
        selectedSemester: "HS26",
        latestValidTerm: null,
        selectedCourseInfo: null,
      }),
    );
    expect(tabNames()[TAB_ORDER.indexOf(TAB.SUMMARY)]).toBe("HS26 Summary");
  });
});
