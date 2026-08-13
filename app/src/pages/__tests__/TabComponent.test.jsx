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

  it("fills the flex column instead of forcing its own height", () => {
    renderTabs();
    // The tabs root is the element owning the tablist; it must shrink to the
    // space left by siblings (e.g. IaChangeNotice) rather than claim h-full.
    const tabsRoot = screen.getByRole("tablist").parentElement;
    expect(tabsRoot.className).toContain("flex-1");
    expect(tabsRoot.className).toContain("min-h-0");
    expect(tabsRoot.className).not.toContain("h-full");
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

/**
 * The Curriculum Map holds drag/plan/scroll state, so it survives tab
 * switches once opened — but it must not mount before the user opens it: its
 * loaders would run at startup and its welcome dialog portals to the body.
 */
describe("TabComponent sticky panels", () => {
  const curriculumIndex = TAB_ORDER.indexOf(TAB.CURRICULUM_MAP);
  const summaryIndex = TAB_ORDER.indexOf(TAB.SUMMARY);
  const stub = PANEL_STUB[TAB.CURRICULUM_MAP];

  it("keeps the Curriculum Map mounted after it has been visited", () => {
    const { rerender } = renderTabs({ selectedTab: curriculumIndex });
    expect(screen.getByText(stub)).toBeInTheDocument();

    rerender(
      <RecoilRoot>
        <TabComponent selectedTab={summaryIndex} onTabSelect={() => {}} />
      </RecoilRoot>,
    );

    expect(screen.getByText(PANEL_STUB[TAB.SUMMARY])).toBeInTheDocument();
    expect(screen.getByText(stub)).toBeInTheDocument();
  });

  it("does not mount the Curriculum Map before its tab is visited", () => {
    renderTabs({ selectedTab: summaryIndex });
    expect(screen.queryByText(stub)).not.toBeInTheDocument();
  });
});
