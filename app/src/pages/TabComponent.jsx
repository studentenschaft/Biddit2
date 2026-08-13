// TabComponent.jsx //

import { Suspense, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import LoadingText from "../components/common/LoadingText";
import ErrorBoundary from "../components/errorHandling/ErrorBoundary";
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
  // Below md the five tabs keep their natural width and the row scrolls; from
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
      <TabList className="flex w-full p-1 overflow-x-auto scrollbar-hide md:overflow-visible">
        {TAB_ORDER.flatMap((tabId) => {
          const tab = (
            <Tab key={tabId} className={tabStyle}>
              {labelFor(tabId)}
            </Tab>
          );
          return GROUP_START_IDS.has(tabId)
            ? [
                <li
                  key={`${tabId}-divider`}
                  aria-hidden="true"
                  data-testid="tab-group-divider"
                  className={dividerStyle}
                />,
                tab,
              ]
            : [tab];
        })}
      </TabList>

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
