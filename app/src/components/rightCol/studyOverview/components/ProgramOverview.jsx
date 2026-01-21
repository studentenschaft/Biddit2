/**
 * ProgramOverview.jsx
 *
 * Main program container with semester grid layout and summary.
 * Sub-components extracted to separate files for better maintainability.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  useCurrentSemester,
  getTypeColor,
  removeSpacesFromSemesterName,
  isSemesterInPast,
  calculateSemesterCredits,
} from '../../../helpers/studyOverviewHelpers';
import SemesterList from './SemesterList';
import CourseDetailsList from './CourseDetailsList';
import ProgramSummaryRow from './ProgramSummaryRow';

const ProgramOverview = ({
  program,
  semesters,
  selectedSemester,
  setSelectedSemester,
  rawScorecard,
}) => {
  const [hoveredCourse, setHoveredCourse] = useState(null);
  const currentSemester = useCurrentSemester();

  // Pre-filter semesters to remove wishlist courses for past semesters
  const filteredSemesters = useMemo(() => {
    return Object.entries(semesters).reduce((acc, [semester, courses]) => {
      if (!courses) return acc;
      const filteredCourses = isSemesterInPast(
        removeSpacesFromSemesterName(semester),
        removeSpacesFromSemesterName(currentSemester)
      )
        ? courses.filter((course) => !course.type.includes("wishlist"))
        : courses;
      acc[semester] = filteredCourses;
      return acc;
    }, {});
  }, [semesters, currentSemester]);

  // Calculate max semester credits for proportional bar sizing
  const maxSemesterCredits = useMemo(() => {
    return Math.max(
      ...Object.values(filteredSemesters).map((courses) =>
        calculateSemesterCredits(courses)
      )
    );
  }, [filteredSemesters]);

  // Sort semesters chronologically
  const getSemesterSortValue = useCallback((semester) => {
    const isSpring = semester.startsWith("FS");
    const isFall = semester.startsWith("HS");
    if (!isSpring && !isFall) return 0;
    const year = semester.slice(2);
    return parseInt(year) * 2 + (isFall ? 1 : 0);
  }, []);

  const sortedSemesters = useMemo(() => {
    return Object.entries(filteredSemesters)
      .filter(([semester]) => semester !== "Unassigned")
      .sort(([semA], [semB]) => {
        return getSemesterSortValue(semA) - getSemesterSortValue(semB);
      });
  }, [filteredSemesters, getSemesterSortValue]);

  return (
    <div className="mb-8">
      <div className="py-2 pl-2 text-xl font-bold bg-gray-100 rounded mb-4">
        {program}
      </div>

      <div className="px-1 py-2 ring-1 ring-black ring-opacity-5 rounded-lg">
        <SemesterList
          sortedSemesters={sortedSemesters}
          selectedSemester={selectedSemester}
          setSelectedSemester={setSelectedSemester}
          setHoveredCourse={setHoveredCourse}
          maxSemesterCredits={maxSemesterCredits}
        />
        <div className="mt-2 flex flex-col items-end text-right">
          <ProgramSummaryRow program={program} rawScorecard={rawScorecard} />
        </div>
      </div>

      {selectedSemester && (
        <CourseDetailsList
          courses={semesters[selectedSemester]}
          selectedSemester={selectedSemester}
          hoveredCourse={hoveredCourse}
        />
      )}

      {/* Type legend */}
      <div className="flex flex-row items-center justify-center w-full pt-8 flex-wrap gap-4">
        {["core", "elective", "contextual"].map((type) => (
          <div key={type} className="flex items-center text-sm">
            <div className={`h-4 w-4 rounded mr-2 ${getTypeColor({ type })}`} />
            <div className="capitalize">{type}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProgramOverview;
