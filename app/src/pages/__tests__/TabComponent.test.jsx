/**
 * Alignment guard for the tab row AND the tab panels: both are rendered from
 * TAB_ORDER, and both are asserted against it here. Panel children are stubbed
 * so the assertions cannot be broken by panel data fetching.
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

/** The stub each tab id must render in its panel. */
const PANEL_STUB = {
  [TAB.COURSE_DETAILS]: "course-info-stub",
  [TAB.CALENDAR]: "calendar-stub",
  [TAB.SUMMARY]: "summary-stub",
  [TAB.CURRICULUM_MAP]: "curriculum-map-stub",
  [TAB.TRANSCRIPT]: "transcript-stub",
};

const renderTabs = ({ selectedTab = 0, initializeState } = {}) =>
  render(
    <RecoilRoot initializeState={initializeState}>
      <TabComponent selectedTab={selectedTab} onTabSelect={() => {}} />
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
    renderTabs({
      initializeState: ({ set }) =>
        set(unifiedCourseDataState, {
          semesters: {},
          selectedSemester: "HS26",
          latestValidTerm: null,
          selectedCourseInfo: null,
        }),
    });
    expect(tabNames()[TAB_ORDER.indexOf(TAB.SUMMARY)]).toBe("HS26 Summary");
  });

});

describe("TabComponent panels", () => {
  it.each(TAB_ORDER.map((tabId, index) => [index, tabId]))(
    "renders the %i-th panel (%s) for the tab at that index",
    (index, tabId) => {
      const { unmount } = renderTabs({ selectedTab: index });

      expect(screen.getByText(PANEL_STUB[tabId])).toBeInTheDocument();
      TAB_ORDER.filter((otherId) => otherId !== tabId).forEach((otherId) => {
        expect(screen.queryByText(PANEL_STUB[otherId])).not.toBeInTheDocument();
      });

      unmount();
    },
  );
});
