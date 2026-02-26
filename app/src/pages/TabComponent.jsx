// TabComponent.jsx //

import { Suspense, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import "react-tabs/style/react-tabs.css";
import LoadingText from "../components/common/LoadingText";
import ErrorBoundary from "../components/errorHandling/ErrorBoundary";

// Tab content components
import CourseInfo from "../components/rightCol/CourseInfo";
import Calendar from "../components/rightCol/Calendar";
import SemesterSummary from "../components/rightCol/SemesterSummary";
import Transcript from "../components/rightCol/Transcript";
import StudyOverview from "../components/rightCol/StudyOverview";
import SmartSearch from "../components/rightCol/SmartSearch";
import CurriculumMap from "../components/rightCol/CurriculumMap";


// For dynamic tab text
import { selectedSemesterSelector } from "../components/recoil/unifiedCourseDataSelectors";
import { useRecoilValue } from "recoil";

export default function TabComponent({ selectedTab, onTabSelect }) {
  const tabStyle =
    "flex-1 h-10 text-center justify-center items-center flex font-medium lg:font-semibold text-xs lg:text-sm rounded-md text-white bg-neutral mx-1";

  // Access selected semester from unified system
  const selectedSemester = useRecoilValue(selectedSemesterSelector);

  // Local state for dynamic tab text
  const [dynamicSummaryText, setDynamicSummaryText] =
    useState("Semester Summary");

  useEffect(() => {
    if (selectedSemester) {
      // Update dynamic tab text without blocking render
      const newSummaryText = `${selectedSemester} Summary`;
      setDynamicSummaryText(newSummaryText);
    }
  }, [selectedSemester]);

  return (
    <Tabs
      className="flex flex-col w-full h-full overflow-hidden"
      selectedIndex={selectedTab}
      onSelect={onTabSelect}
    >
      <TabList className="flex w-full p-1 pt-2 flex-wrap">
        <Tab className={tabStyle}>Course Details</Tab>
        <Tab className={tabStyle}>Calendar</Tab>
        <Tab className={tabStyle}>{dynamicSummaryText}</Tab>
        <Tab className={tabStyle}>Transcript</Tab>
        <Tab className={tabStyle}>Study Overview</Tab>
        <Tab className={tabStyle}>Curriculum Map</Tab>
        <Tab className={tabStyle}>Smart Search</Tab>
      </TabList>

      <TabPanel>
        <ErrorBoundary>
          <Suspense
            fallback={<LoadingText>Loading Course Details...</LoadingText>}
          >
            <CourseInfo />
          </Suspense>
        </ErrorBoundary>
      </TabPanel>
      <TabPanel>
        <ErrorBoundary>
          <Suspense fallback={<LoadingText>Loading Calendar...</LoadingText>}>
            <Calendar />
          </Suspense>
        </ErrorBoundary>
      </TabPanel>
      <TabPanel>
        <ErrorBoundary>
          <Suspense
            fallback={<LoadingText>Loading Semester Summary...</LoadingText>}
          >
            <SemesterSummary />
          </Suspense>
        </ErrorBoundary>
      </TabPanel>
      <TabPanel>
        <ErrorBoundary>
          <Transcript />
        </ErrorBoundary>
      </TabPanel>
      <TabPanel>
        <ErrorBoundary>
          <Suspense
            fallback={<LoadingText>Loading Study Overview...</LoadingText>}
          >
            <StudyOverview />
          </Suspense>
        </ErrorBoundary>
      </TabPanel>
      <TabPanel>
        <ErrorBoundary>
          <Suspense
            fallback={<LoadingText>Loading Curriculum Map...</LoadingText>}
          >
            <CurriculumMap />
          </Suspense>
        </ErrorBoundary>
      </TabPanel>
      <TabPanel>
        <ErrorBoundary>
          <Suspense
            fallback={<LoadingText>Loading Smart Search...</LoadingText>}
          >
            <SmartSearch />
          </Suspense>
        </ErrorBoundary>
      </TabPanel>
    </Tabs>
  );
}

TabComponent.propTypes = {
  selectedTab: PropTypes.number.isRequired,
  onTabSelect: PropTypes.func.isRequired,
};

export { TabComponent };
