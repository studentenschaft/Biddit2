/**
 * SemesterRow.jsx
 *
 * Individual semester display with course bars for study overview.
 * Shows semester name, visual course representation, ECTS total, and grade/details.
 */

import React from 'react';
import { useSetRecoilState } from 'recoil';
import { selectedTabAtom } from '../../../recoil/selectedTabAtom';
import {
  useCurrentSemester,
  removeSpacesFromSemesterName,
  calculateSemesterCredits,
  sortCoursesByType,
} from '../../../helpers/studyOverviewHelpers';
import CourseBar from './CourseBar';

const SemesterRow = ({
  semester,
  courses,
  selectedSemester,
  setSelectedSemester,
  setHoveredCourse,
  maxSemesterCredits,
}) => {
  const currentSemester = useCurrentSemester();
  const isCurrentSemester =
    removeSpacesFromSemesterName(semester) ===
    removeSpacesFromSemesterName(currentSemester);
  const setSelectedTab = useSetRecoilState(selectedTabAtom);

  const sortedCourses = sortCoursesByType(courses || []);

  const calculateAverageGrade = (list) => {
    const graded = list.filter((c) => typeof c.grade === "number");
    if (graded.length === 0) return null;
    return graded.reduce((sum, c) => sum + c.grade, 0) / graded.length;
  };
  const avgGrade = calculateAverageGrade(courses || []);

  return (
    <div
      className="grid grid-cols-12 gap-2 md:gap-4 mb-2 items-center"
      onClick={() => setSelectedSemester(semester)}
      onMouseEnter={() => {
        if (selectedSemester !== semester) {
          setSelectedSemester(semester);
        }
      }}
    >
      {/* Column 1: Semester name */}
      <div
        className={`col-span-2 md:col-span-1 font-semibold cursor-pointer ${
          selectedSemester === semester ? "text-green-800" : ""
        }`}
      >
        {removeSpacesFromSemesterName(semester)}
      </div>

      {/* Column 2: Course bars */}
      <div className="col-span-6 md:col-span-8 flex flex-row h-8">
        {sortedCourses.map((course, idx) => (
          <CourseBar
            key={idx}
            course={course}
            setHoveredCourse={setHoveredCourse}
            maxSemesterCredits={maxSemesterCredits}
          />
        ))}
      </div>

      {/* Column 3: ECTS total */}
      <div className="col-span-2 md:col-span-1 text-right font-semibold">
        <span
          className={
            calculateSemesterCredits(courses || []) > 30 ? "text-red-500" : ""
          }
        >
          {calculateSemesterCredits(courses || [])} ECTS
        </span>
        {calculateSemesterCredits(courses || []) > 30 && (
          <div className="mb-2 text-gray-500 text-xs rounded py-1 px-2">
            Exceeds recommended credit limit
          </div>
        )}
      </div>

      {/* Column 4: Grade or Details button */}
      <div className="col-span-2 md:col-span-2 text-center font-semibold">
        {isCurrentSemester ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTab(2);
            }}
            className="bg-green-800 text-white px-2 md:px-4 py-1.5 rounded
              hover:bg-green-700 active:bg-green-900
              transition-all duration-200 ease-in-out
              focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2
              whitespace-nowrap text-xs md:text-sm"
            aria-label={`View details for ${semester}`}
          >
            Details
          </button>
        ) : (
          <div>
            {avgGrade ? avgGrade.toFixed(2) : "N/A"}
          </div>
        )}
      </div>
    </div>
  );
};

export default SemesterRow;
