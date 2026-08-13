// TabComponent.jsx //

import { Suspense, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import "react-tabs/style/react-tabs.css";
import LoadingText from "../components/common/LoadingText";
import ErrorBoundary from "../components/errorHandling/ErrorBoundary";
import { TAB, TAB_GROUPS, TAB_LABELS, TAB_ORDER } from "../constants/tabs";

// Tab content components
import CourseInfo from "../components/rightCol/CourseInfo";
import Calendar from "../components/rightCol/Calendar";
import SemesterSummary from "../components/rightCol/SemesterSummary";
import Transcript from "../components/rightCol/Transcript";
import CurriculumMap from "../components/rightCol/CurriculumMap";


// For dynamic tab text
import { selectedSemesterSelector } from "../components/recoil/unifiedCourseDataSelectors";
import { useRecoilValue } from "recoil";

/**
 * Tab row and panels are both rendered from TAB_ORDER, so a reorder in
 * constants/tabs.js moves the label and its panel together.
 *
 * Ids that start a group get the gap that acts as the group divider.
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
  [TAB.TRANSCRIPT]: <Transcript />,
};

export default function TabComponent({ selectedTab, onTabSelect }) {
  const tabStyle =
    "flex-1 h-10 text-center justify-center items-center flex font-medium lg:font-semibold text-xs lg:text-sm rounded-md text-white bg-neutral mx-1";

  // Access selected semester from unified system
  const selectedSemester = useRecoilValue(selectedSemesterSelector);

  // Local state for dynamic tab text
  const [dynamicSummaryText, setDynamicSummaryText] = useState(
    TAB_LABELS[TAB.SUMMARY],
  );

  useEffect(() => {
    if (selectedSemester) {
      // Update dynamic tab text without blocking render
      const newSummaryText = `${selectedSemester} Summary`;
      setDynamicSummaryText(newSummaryText);
    }
  }, [selectedSemester]);

  const labelFor = (tabId) =>
    tabId === TAB.SUMMARY ? dynamicSummaryText : TAB_LABELS[tabId];

  // The root uses flex-1 + min-h-0 rather than h-full: siblings such as
  // IaChangeNotice share the right column's flex column, so the tabs shrink
  // around them instead of pushing the panel below the fold.
  return (
    <Tabs
      className="flex flex-col w-full flex-1 min-h-0 overflow-hidden"
      selectedIndex={selectedTab}
      onSelect={onTabSelect}
    >
      <div
        aria-hidden="true"
        className="flex w-full px-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500"
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
      <TabList className="flex w-full p-1">
        {TAB_ORDER.map((tabId) => (
          <Tab
            key={tabId}
            className={
              GROUP_START_IDS.has(tabId) ? `${tabStyle} ml-4` : tabStyle
            }
          >
            {labelFor(tabId)}
          </Tab>
        ))}
      </TabList>

      {TAB_ORDER.map((tabId) => (
        <TabPanel key={tabId}>
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
