/**
 * Alignment guard for the tab row AND the tab panels: both are rendered from
 * TAB_ORDER, and both are asserted against it here. Panel children are stubbed
 * so the assertions cannot be broken by panel data fetching.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecoilRoot } from "recoil";
import { TAB, TAB_GROUPS, TAB_LABELS, TAB_ORDER } from "../../constants/tabs";
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
vi.mock("../../components/rightCol/StudyOverview", () => ({
  default: () => <div>study-overview-stub</div>,
}));

/**
 * The affordance hook measures a real layout, which jsdom does not have — it
 * is driven directly here instead. The ref stays real so the fades can be
 * clicked against the actual scroll container.
 */
const affordance = vi.hoisted(() => ({
  canScrollLeft: false,
  canScrollRight: false,
}));

vi.mock("../../components/helpers/useHorizontalScrollAffordance", async () => {
  const { useRef } = await import("react");
  return {
    useHorizontalScrollAffordance: () => ({
      scrollContainerRef: useRef(null),
      canScrollLeft: affordance.canScrollLeft,
      canScrollRight: affordance.canScrollRight,
    }),
  };
});

beforeEach(() => {
  affordance.canScrollLeft = false;
  affordance.canScrollRight = false;
});

/** The stub each tab id must render in its panel. */
const PANEL_STUB = {
  [TAB.COURSE_DETAILS]: "course-info-stub",
  [TAB.CALENDAR]: "calendar-stub",
  [TAB.SUMMARY]: "summary-stub",
  [TAB.CURRICULUM_MAP]: "curriculum-map-stub",
  [TAB.STUDY_OVERVIEW]: "study-overview-stub",
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

/** The element that actually scrolls the tab row (the TabList's parent). */
const tabScroller = () => screen.getByRole("tablist").parentElement;
/** The positioned wrapper holding the scroller and the edge fades. */
const tabRowWrapper = () => tabScroller().parentElement;
/** The react-tabs root that owns the whole tab UI. */
const tabScrollRoot = () =>
  screen.getByRole("tablist").closest("[data-rttabs]");

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
    const tabsRoot = tabScrollRoot();
    expect(tabsRoot.className).toContain("flex-1");
    expect(tabsRoot.className).toContain("min-h-0");
    expect(tabsRoot.className).not.toContain("h-full");
  });

  it("scrolls the tab row horizontally on small screens", () => {
    renderTabs();
    const scroller = tabScroller();
    expect(scroller.className).toContain("overflow-x-auto");
    expect(scroller.className).toContain("scrollbar-hide");
    expect(scroller.className).toContain("md:overflow-visible");
    // The row grows past the viewport below md and hands the width back at md+.
    expect(screen.getByRole("tablist").className).toContain("min-w-max");
    expect(screen.getByRole("tablist").className).toContain("md:min-w-0");
    // Tabs keep their natural width while scrolling, and only share the row
    // equally once there is space for it. md:min-w-0 restores the min-content
    // floor on desktop so a narrow column cannot push the last tab out of the
    // Tabs root's hidden overflow.
    screen.getAllByRole("tab").forEach((tab) => {
      expect(tab.className).toContain("flex-none");
      expect(tab.className).toContain("whitespace-nowrap");
      expect(tab.className).toContain("min-w-max");
      expect(tab.className).toContain("md:min-w-0");
      expect(tab.className).toContain("md:flex-1");
    });
  });

  /**
   * react-tabs declares `react-tabs__tab` as a *defaultProp*, so the className
   * TabComponent passes replaces it — a stylesheet rule on `.react-tabs__tab`
   * matches nothing. The focus ring (WCAG 2.4.7) must therefore ride on the
   * Tailwind classes, and only `react-tabs__tab--selected` (selectedClassName)
   * survives on the element. Both halves are pinned here so the ring cannot
   * silently die again.
   */
  it("carries a visible keyboard focus ring on every tab", () => {
    renderTabs();
    screen.getAllByRole("tab").forEach((tab) => {
      // The bare `focus-visible:outline` sets outline-style: solid. Without it
      // the width/offset/color utilities paint nothing and the ring silently
      // degrades to the UA default — so it is asserted as a whole token, not
      // as a substring of `focus-visible:outline-2`.
      expect(tab.className.split(/\s+/)).toContain("focus-visible:outline");
      expect(tab.className).toContain("focus-visible:outline-2");
      expect(tab.className).toContain("focus-visible:outline-offset-2");
      expect(tab.className).toContain("focus-visible:outline-gray-800");
    });
  });

  it("does not receive the react-tabs default classes it would style against", () => {
    renderTabs();
    expect(screen.getByRole("tablist").className).not.toContain(
      "react-tabs__tab-list",
    );
    screen.getAllByRole("tab").forEach((tab) => {
      expect(tab.className.split(/\s+/)).not.toContain("react-tabs__tab");
    });
    // The selected marker DOES land — it is a separate prop the component
    // leaves at its default, and react-tabs.css still targets it.
    expect(screen.getAllByRole("tab")[0].className).toContain(
      "react-tabs__tab--selected",
    );
  });

  /**
   * The divider is a non-Tab <li> inside react-tabs' <ul role="tablist">.
   * react-tabs indexes tabs by tabsRole (getTabsCount/deepMap) and by the
   * [data-rttab] siblings (handleClick), so an extra child must not shift the
   * bookkeeping — the tab count assertion above is the regression guard, and
   * it is repeated here against the divider explicitly.
   */
  it("separates the scope groups with a divider that is not a tab", () => {
    renderTabs();
    const dividers = screen.getAllByTestId("tab-group-divider");
    expect(dividers).toHaveLength(TAB_GROUPS.length - 1);
    expect(screen.getAllByRole("tab")).toHaveLength(TAB_ORDER.length);

    const [divider] = dividers;
    // Owned children of role="tablist" must be tabs, so the rule is hidden.
    expect(divider).toHaveAttribute("aria-hidden", "true");
    expect(divider).not.toHaveAttribute("data-rttab");
    expect(divider.tagName).toBe("LI");
    // Visible at both widths (no md: prefix), full row height, hairline grey.
    expect(divider.className).toContain("w-px");
    expect(divider.className).toContain("self-stretch");
    expect(divider.className).toContain("bg-gray-300");
    expect(divider.className).not.toContain("hidden");

    // It opens the second group: only that group's mobile scope label (hidden
    // at md+) stands between the rule and the group's first tab.
    const firstMyDegreeTab = screen.getByText(
      TAB_LABELS[TAB_GROUPS[1].tabs[0]],
    );
    const groupLabel = divider.nextElementSibling;
    expect(groupLabel).toHaveAttribute("data-testid", "tab-group-label");
    expect(groupLabel.textContent).toBe(TAB_GROUPS[1].label);
    expect(groupLabel.nextElementSibling).toBe(firstMyDegreeTab);
  });

  // react-tabs derives the clicked index from the [data-rttab] siblings of the
  // clicked node, so a stray <li> in the row could silently offset selection.
  it("still reports the TAB_ORDER index of a tab clicked after the divider", () => {
    const onTabSelect = vi.fn();
    render(
      <RecoilRoot>
        <TabComponent selectedTab={0} onTabSelect={onTabSelect} />
      </RecoilRoot>,
    );
    const lastTabId = TAB_ORDER[TAB_ORDER.length - 1];
    fireEvent.click(screen.getByText(TAB_LABELS[lastTabId]));
    expect(onTabSelect).toHaveBeenCalledWith(
      TAB_ORDER.indexOf(lastTabId),
      0,
      expect.anything(),
    );
  });

  it("hides the decorative group headings on small screens", () => {
    renderTabs();
    // The scope labels sit directly above the tab row; their static width
    // split cannot track the tabs once the row scrolls.
    const groupHeadings = tabRowWrapper().previousElementSibling;
    expect(groupHeadings).toHaveAttribute("aria-hidden", "true");
    expect(groupHeadings.className).toContain("hidden");
    expect(groupHeadings.className).toContain("md:flex");
  });
});

/**
 * Below md the headings above the row are hidden, so each group is announced
 * by a compact label riding inside the scrolling row — it stays aligned with
 * the tabs it names because it scrolls with them.
 */
describe("TabComponent mobile group labels", () => {
  it("renders one label per group, in front of that group's first tab", () => {
    renderTabs();
    const labels = screen.getAllByTestId("tab-group-label");
    expect(labels).toHaveLength(TAB_GROUPS.length);
    expect(labels.map((label) => label.textContent)).toEqual(
      TAB_GROUPS.map(({ label }) => label),
    );
    labels.forEach((label, index) => {
      expect(label.nextElementSibling).toBe(
        screen.getByText(TAB_LABELS[TAB_GROUPS[index].tabs[0]]),
      );
    });
  });

  it("keeps the labels out of the tablist's accessibility tree", () => {
    renderTabs();
    // role="tablist" only owns role="tab" children, and the count must not move.
    expect(screen.getAllByRole("tab")).toHaveLength(TAB_ORDER.length);
    screen.getAllByTestId("tab-group-label").forEach((label) => {
      expect(label).toHaveAttribute("aria-hidden", "true");
      expect(label).not.toHaveAttribute("data-rttab");
      expect(label.tagName).toBe("LI");
    });
  });

  it("shows the labels only below md, where the headings are gone", () => {
    renderTabs();
    screen.getAllByTestId("tab-group-label").forEach((label) => {
      expect(label.className).toContain("md:hidden");
      expect(label.className).toContain("uppercase");
    });
  });
});

/**
 * With the scrollbar hidden there is nothing to say the row continues, so the
 * overflowing edges get a gradient fade that doubles as a step control.
 */
describe("TabComponent scroll affordance", () => {
  const leftFade = () =>
    screen.queryByRole("button", { name: "Scroll tabs left" });
  const rightFade = () =>
    screen.queryByRole("button", { name: "Scroll tabs right" });

  it("shows no fade while the row fits its container", () => {
    renderTabs();
    expect(leftFade()).not.toBeInTheDocument();
    expect(rightFade()).not.toBeInTheDocument();
  });

  it("fades the edge the row can still scroll towards", () => {
    affordance.canScrollRight = true;
    renderTabs();
    expect(leftFade()).not.toBeInTheDocument();
    expect(rightFade()).toBeInTheDocument();
  });

  it("fades both edges once the row is scrolled off both ends", () => {
    affordance.canScrollLeft = true;
    affordance.canScrollRight = true;
    renderTabs();
    expect(leftFade()).toBeInTheDocument();
    expect(rightFade()).toBeInTheDocument();
  });

  // The row does not overflow from md up, where the tabs share the width.
  it("keeps the fades off the desktop layout", () => {
    affordance.canScrollLeft = true;
    affordance.canScrollRight = true;
    renderTabs();
    [leftFade(), rightFade()].forEach((fade) => {
      expect(fade.className).toContain("md:hidden");
    });
  });

  /**
   * The gradient and the tap target used to be one w-12 button at each end —
   * ~96px of a 390px row that ate taps meant for the tabs underneath. The
   * gradient is now inert decoration and only the chevron takes the tap.
   */
  it("keeps the gradient out of the tap path and the tap target narrow", () => {
    affordance.canScrollLeft = true;
    affordance.canScrollRight = true;
    renderTabs();

    ["left", "right"].forEach((side) => {
      const fade = screen.getByTestId(`tab-scroll-fade-${side}`);
      expect(fade.className).toContain("pointer-events-none");
      expect(fade).toHaveAttribute("aria-hidden", "true");
      expect(fade.tagName).toBe("DIV");
    });

    [leftFade(), rightFade()].forEach((button) => {
      const classes = button.className.split(/\s+/);
      expect(classes).toContain("w-8");
      expect(classes).not.toContain("w-12");
    });
  });

  it.each([
    ["Scroll tabs right", "canScrollRight", 180],
    ["Scroll tabs left", "canScrollLeft", -180],
  ])("steps the row by 60%% of its width from %s", (name, flag, expected) => {
    affordance[flag] = true;
    renderTabs();

    const scroller = tabScroller();
    Object.defineProperty(scroller, "clientWidth", {
      value: 300,
      configurable: true,
    });
    scroller.scrollBy = vi.fn();

    fireEvent.click(screen.getByRole("button", { name }));
    expect(scroller.scrollBy).toHaveBeenCalledWith({
      left: expected,
      behavior: "smooth",
    });
  });
});

/**
 * Selection can move without the user swiping (deep link, keyboard, restored
 * state), and the tab it lands on may sit outside the scrolled row.
 */
describe("TabComponent selection follow", () => {
  const originalScrollIntoView = Element.prototype.scrollIntoView;
  let scrolled;

  beforeEach(() => {
    scrolled = [];
    Element.prototype.scrollIntoView = function scrollIntoView(options) {
      scrolled.push({ element: this, options });
    };
  });

  afterEach(() => {
    // jsdom ships no scrollIntoView, so this usually restores `undefined` —
    // which is exactly the case the component feature-detects against.
    Element.prototype.scrollIntoView = originalScrollIntoView;
  });

  it("brings the selected tab into view on mount and on every change", () => {
    const lastIndex = TAB_ORDER.length - 1;
    const { rerender } = renderTabs({ selectedTab: 0 });

    expect(scrolled).toHaveLength(1);
    expect(scrolled[0].element).toBe(screen.getAllByRole("tab")[0]);
    expect(scrolled[0].options).toEqual({
      block: "nearest",
      inline: "nearest",
    });

    rerender(
      <RecoilRoot>
        <TabComponent selectedTab={lastIndex} onTabSelect={() => {}} />
      </RecoilRoot>,
    );

    expect(scrolled).toHaveLength(2);
    expect(scrolled[1].element).toBe(screen.getAllByRole("tab")[lastIndex]);
  });

  // The dividers and group labels share the row, so an index taken over all
  // children would follow the wrong element.
  it("targets the tab at the selected index, not the row's nth child", () => {
    const summaryIndex = TAB_ORDER.indexOf(TAB.SUMMARY);
    renderTabs({ selectedTab: summaryIndex });
    expect(scrolled[0].element.textContent.trim()).toBe(
      TAB_LABELS[TAB.SUMMARY],
    );
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

  // Must walk the real flow — land on Summary (the default), open the map,
  // leave again. Starting *at* the map index would pass on the useState
  // initializer alone, leaving the visit-tracking effect untested.
  it("keeps the Curriculum Map mounted after it has been visited", () => {
    const { rerender } = renderTabs({ selectedTab: summaryIndex });
    const selectTab = (index) =>
      rerender(
        <RecoilRoot>
          <TabComponent selectedTab={index} onTabSelect={() => {}} />
        </RecoilRoot>,
      );

    expect(screen.queryByText(stub)).not.toBeInTheDocument();

    selectTab(curriculumIndex);
    expect(screen.getByText(stub)).toBeInTheDocument();

    selectTab(summaryIndex);
    expect(screen.getByText(PANEL_STUB[TAB.SUMMARY])).toBeInTheDocument();
    expect(screen.getByText(stub)).toBeInTheDocument();
  });

  it("does not mount the Curriculum Map before its tab is visited", () => {
    renderTabs({ selectedTab: summaryIndex });
    expect(screen.queryByText(stub)).not.toBeInTheDocument();
  });

  /**
   * The complement of the test above, and the one that pins STICKY_TAB_IDS to
   * exactly {curriculum-map}: without it, adding any other id to the set is a
   * silent change. Staying mounted is the exception — Calendar in particular
   * must NOT, because FullCalendar measures a zero-width container inside
   * `display: none`.
   */
  it.each(TAB_ORDER.filter((tabId) => tabId !== TAB.CURRICULUM_MAP))(
    "tears the %s panel down again once its tab is left",
    (tabId) => {
      const tabIndex = TAB_ORDER.indexOf(tabId);
      const elsewhere = TAB_ORDER.findIndex((otherId) => otherId !== tabId);

      const { rerender } = renderTabs({ selectedTab: elsewhere });
      const selectTab = (index) =>
        rerender(
          <RecoilRoot>
            <TabComponent selectedTab={index} onTabSelect={() => {}} />
          </RecoilRoot>,
        );

      selectTab(tabIndex);
      expect(screen.getByText(PANEL_STUB[tabId])).toBeInTheDocument();

      selectTab(elsewhere);
      expect(screen.queryByText(PANEL_STUB[tabId])).not.toBeInTheDocument();
    },
  );
});
