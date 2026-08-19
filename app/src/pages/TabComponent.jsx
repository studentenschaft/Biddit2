// TabComponent.jsx //

import { Suspense, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/solid";
import LoadingText from "../components/common/LoadingText";
import ErrorBoundary from "../components/errorHandling/ErrorBoundary";
import { useHorizontalScrollAffordance } from "../components/helpers/useHorizontalScrollAffordance";
import {
  TAB,
  TAB_GROUPS,
  TAB_LABELS,
  TAB_ORDER,
  tabIdAt,
} from "../constants/tabs";

// Tab content components
import CourseInfo from "../components/rightCol/CourseInfo";
import Calendar from "../components/rightCol/Calendar";
import SemesterSummary from "../components/rightCol/SemesterSummary";
import Transcript from "../components/rightCol/Transcript";
import CurriculumMap from "../components/rightCol/CurriculumMap";
import StudyOverview from "../components/rightCol/StudyOverview";


// For dynamic tab text
import { selectedSemesterSelector } from "../components/recoil/unifiedCourseDataSelectors";
import { useRecoilValue } from "recoil";

/**
 * Tab row and panels are both rendered from TAB_ORDER, so a reorder in
 * constants/tabs.js moves the label and its panel together.
 *
 * Ids that start a group get the divider rule rendered in front of them.
 */
const GROUP_START_IDS = new Set(TAB_GROUPS.slice(1).map(({ tabs }) => tabs[0]));

/**
 * Group label per first tab of a group. Below md the headings above the row
 * are hidden (their static width split cannot follow a scrolling row), so the
 * label rides inside the row instead and scrolls with the tabs it names.
 */
const GROUP_LABEL_BY_FIRST_TAB = new Map(
  TAB_GROUPS.map(({ label, tabs }) => [tabs[0], label]),
);

/** Share of the visible row a chevron tap travels. */
const SCROLL_STEP_RATIO = 0.6;

const TAB_PANEL_CONTENT = {
  [TAB.COURSE_DETAILS]: (
    <Suspense fallback={<LoadingText>Loading Course Details...</LoadingText>}>
      <CourseInfo />
    </Suspense>
  ),
  [TAB.CALENDAR]: (
    <Suspense fallback={<LoadingText>Loading Calendar...</LoadingText>}>
      <Calendar />
    </Suspense>
  ),
  [TAB.SUMMARY]: (
    <Suspense fallback={<LoadingText>Loading Semester Summary...</LoadingText>}>
      <SemesterSummary />
    </Suspense>
  ),
  [TAB.CURRICULUM_MAP]: (
    <Suspense fallback={<LoadingText>Loading Curriculum Map...</LoadingText>}>
      <CurriculumMap />
    </Suspense>
  ),
  [TAB.STUDY_OVERVIEW]: (
    <Suspense fallback={<LoadingText>Loading Study Overview...</LoadingText>}>
      <StudyOverview />
    </Suspense>
  ),
  [TAB.TRANSCRIPT]: <Transcript />,
};

/**
 * Panels that stay mounted once visited, instead of being torn down on the
 * next tab switch (react-tabs unmounts unselected panels by default).
 *
 * Only the Curriculum Map: it holds drag/plan/scroll state that a remount
 * throws away, and its loaders are all guarded by Recoil-backed flags
 * (`curriculumPlansRegistryState.isLoaded`, `scorecardDataState.isLoaded`,
 * `semesters[key].available`), so staying mounted costs no extra requests.
 *
 * Sticky rather than always-on: mounting it at startup would front-load its
 * scorecard/plan fetches for users who never open it, and its welcome dialog
 * portals to document.body — it would greet first-time users over whichever
 * tab they actually landed on. Not a blanket rule either: Calendar must not
 * render inside `display:none`, where FullCalendar measures a zero-width
 * container.
 */
const STICKY_TAB_IDS = new Set([TAB.CURRICULUM_MAP]);

export default function TabComponent({ selectedTab, onTabSelect }) {
  // Below md the tabs keep their natural width and the row scrolls; from
  // md up they share the row equally. Labels never wrap (whitespace-nowrap),
  // so md:min-w-0 lets a tab shrink below its min-content width and clip its
  // label rather than push the last tab out of the hidden overflow.
  // The focus ring must be a Tailwind utility: react-tabs' default `react-tabs__tab`
  // class is a defaultProp that this className replaces, so a stylesheet rule on
  // it would never match.
  const tabStyle =
    "flex-none min-w-max md:min-w-0 whitespace-nowrap px-3 md:px-0 md:flex-1 h-10 text-center justify-center items-center flex font-medium lg:font-semibold text-xs lg:text-sm rounded-md text-white bg-neutral mx-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-800";

  // Group divider: a hairline rule between the scope groups, at every width.
  // It is an <li> because TabList renders a <ul>, and aria-hidden because
  // role="tablist" only owns role="tab" children. react-tabs is unaffected by
  // it: getTabsCount/deepMap only visit nodes whose type carries a tabsRole,
  // and handleClick derives the index from the [data-rttab] siblings only.
  const dividerStyle = "mx-2 my-1 w-px flex-none self-stretch bg-gray-300";

  // Scope label inside the scrolling row, mobile only: at md+ the headings
  // above the row do this job. aria-hidden for the same reason as the divider
  // — role="tablist" only owns role="tab" children.
  const groupLabelStyle =
    "md:hidden mx-1 flex-none self-center whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-gray-500";

  // Edge fades that tell the user the row continues. Decoration only, and
  // wider than the control they sit under: as a tap target a w-12 fade at each
  // end swallowed ~96px of a 390px row, so a tab the gradient merely grazed
  // could not be selected at all.
  const fadeStyle = "md:hidden pointer-events-none absolute inset-y-0 w-12";

  // The step control itself: the chevron and little more, so it covers only
  // the outermost sliver of the row.
  const fadeButtonStyle =
    "md:hidden absolute inset-y-0 flex w-8 items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-800";

  // The Summary tab names the semester it summarises.
  const selectedSemester = useRecoilValue(selectedSemesterSelector);
  const summaryLabel = selectedSemester
    ? `${selectedSemester} Summary`
    : TAB_LABELS[TAB.SUMMARY];

  // Tabs the user has opened at least once — a sticky panel only starts
  // surviving switches after its first visit.
  const [visitedTabs, setVisitedTabs] = useState(
    () => new Set([tabIdAt(selectedTab)]),
  );

  useEffect(() => {
    const tabId = tabIdAt(selectedTab);
    setVisitedTabs((visited) =>
      visited.has(tabId) ? visited : new Set(visited).add(tabId),
    );
  }, [selectedTab]);

  // Below md the row scrolls, so the selected tab can sit off-screen after a
  // swipe-free selection (deep link, keyboard, restored state).
  const { scrollContainerRef, canScrollLeft, canScrollRight } =
    useHorizontalScrollAffordance();

  useEffect(() => {
    const row = scrollContainerRef.current;
    // react-tabs owns the Tab nodes (it overwrites any tabRef we pass), so the
    // selected one is read back off the row by index.
    const tab = row?.querySelectorAll('[role="tab"]')[selectedTab];
    // jsdom has no scrollIntoView; feature-detect rather than swallow errors.
    if (tab && typeof tab.scrollIntoView === "function") {
      tab.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [selectedTab, scrollContainerRef]);

  const scrollRowBy = (direction) => {
    const row = scrollContainerRef.current;
    if (!row || typeof row.scrollBy !== "function") return;
    row.scrollBy({
      left: direction * row.clientWidth * SCROLL_STEP_RATIO,
      behavior: "smooth",
    });
  };

  const labelFor = (tabId) =>
    tabId === TAB.SUMMARY ? summaryLabel : TAB_LABELS[tabId];

  // The root uses flex-1 + min-h-0 rather than h-full: siblings such as
  // IaChangeNotice share the right column's flex column, so the tabs shrink
  // around them instead of pushing the panel below the fold.
  return (
    <Tabs
      className="flex flex-col w-full flex-1 min-h-0 overflow-hidden"
      selectedIndex={selectedTab}
      onSelect={onTabSelect}
    >
      {/* Decorative group headings: the static width split cannot follow the
          tabs once the row scrolls, so they only show from md up. */}
      <div
        aria-hidden="true"
        className="hidden md:flex w-full px-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500"
      >
        {TAB_GROUPS.map(({ label, tabs }) => (
          <span
            key={label}
            className="text-center"
            style={{ flex: `${tabs.length} ${tabs.length} 0%` }}
          >
            {label}
          </span>
        ))}
      </div>
      {/* The row itself scrolls below md; the fades overlay its edges, so both
          live in a positioned wrapper. react-tabs finds the TabList through it
          (deepMap recurses into non-tab children). */}
      <div className="relative">
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto scrollbar-hide md:overflow-visible"
        >
          {/* min-w-max lets the row grow past the viewport and scroll; at md+
              md:min-w-0 hands the width back so the tabs share it equally. */}
          <TabList className="flex w-full min-w-max md:min-w-0 p-1">
            {TAB_ORDER.flatMap((tabId) => {
              const tab = (
                <Tab key={tabId} className={tabStyle}>
                  {labelFor(tabId)}
                </Tab>
              );
              const before = [];
              if (GROUP_START_IDS.has(tabId)) {
                before.push(
                  <li
                    key={`${tabId}-divider`}
                    aria-hidden="true"
                    data-testid="tab-group-divider"
                    className={dividerStyle}
                  />,
                );
              }
              const groupLabel = GROUP_LABEL_BY_FIRST_TAB.get(tabId);
              if (groupLabel) {
                before.push(
                  <li
                    key={`${tabId}-group-label`}
                    aria-hidden="true"
                    data-testid="tab-group-label"
                    className={groupLabelStyle}
                  >
                    {groupLabel}
                  </li>,
                );
              }
              return [...before, tab];
            })}
          </TabList>
        </div>
        {canScrollLeft && (
          <>
            <div
              aria-hidden="true"
              data-testid="tab-scroll-fade-left"
              className={`${fadeStyle} left-0`}
              style={{
                background:
                  "linear-gradient(to right, rgba(255,255,255,1), transparent)",
              }}
            />
            <button
              type="button"
              aria-label="Scroll tabs left"
              onClick={() => scrollRowBy(-1)}
              className={`${fadeButtonStyle} left-0`}
            >
              <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
            </button>
          </>
        )}
        {canScrollRight && (
          <>
            <div
              aria-hidden="true"
              data-testid="tab-scroll-fade-right"
              className={`${fadeStyle} right-0`}
              style={{
                background:
                  "linear-gradient(to left, rgba(255,255,255,1), transparent)",
              }}
            />
            <button
              type="button"
              aria-label="Scroll tabs right"
              onClick={() => scrollRowBy(1)}
              className={`${fadeButtonStyle} right-0`}
            >
              <ChevronRightIcon className="w-5 h-5 text-gray-600" />
            </button>
          </>
        )}
      </div>

      {TAB_ORDER.map((tabId) => (
        <TabPanel
          key={tabId}
          forceRender={STICKY_TAB_IDS.has(tabId) && visitedTabs.has(tabId)}
        >
          <ErrorBoundary>{TAB_PANEL_CONTENT[tabId]}</ErrorBoundary>
        </TabPanel>
      ))}
    </Tabs>
  );
}

TabComponent.propTypes = {
  selectedTab: PropTypes.number.isRequired,
  onTabSelect: PropTypes.func.isRequired,
};

export { TabComponent };
