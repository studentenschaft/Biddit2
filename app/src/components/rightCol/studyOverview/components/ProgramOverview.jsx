/**
 * ProgramOverview.jsx
 * 
 * Extracted from original StudyOverview component
 * Main program container with semester grid layout and summary
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useSetRecoilState } from 'recoil';
import { selectedTabAtom } from '../../../recoil/selectedTabAtom';
import { LockClosed } from '../../../leftCol/bottomRow/LockClosed';
import { 
  useCurrentSemester, 
  getTypeColor, 
  removeSpacesFromSemesterName,
  isSemesterInPast,
  calculateSemesterCredits,
  sortCoursesByType,
  filterCoursesForSemester
} from '../../../helpers/studyOverviewHelpers';

// SemesterList component - renders list of semester rows
const SemesterList = ({
  sortedSemesters,
  selectedSemester,
  setSelectedSemester,
  setHoveredCourse,
  maxSemesterCredits,
}) => {
  return (
    <>
      {sortedSemesters.map(([semester, courses]) => (
        <SemesterRow
          key={semester}
          semester={semester}
          courses={courses}
          selectedSemester={selectedSemester}
          setSelectedSemester={setSelectedSemester}
          setHoveredCourse={setHoveredCourse}
          maxSemesterCredits={maxSemesterCredits}
        />
      ))}
    </>
  );
};

// SemesterRow component - individual semester display with course bars
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

// CourseBar component - visual course representation with color coding
const CourseBar = ({ course, setHoveredCourse, maxSemesterCredits }) => {
  const isEnriched = course.isEnriched !== false; // Default to true for existing courses

  return (
    <div
      className={`h-full m-0.5 md:m-1 rounded flex items-center justify-center text-white
        ${getTypeColor(course)}
        transition-all duration-200
        hover:shadow-lg hover:scale-y-105
        ${!isEnriched ? "animate-pulse opacity-70" : ""}`}
      style={{
        width: `${(course.credits / maxSemesterCredits) * 100}%`,
        minWidth: "0.25rem",
      }}
      onMouseEnter={() => setHoveredCourse(course)}
      onMouseLeave={() => setHoveredCourse(null)}
      title={!isEnriched ? "Loading course details..." : course.name}
    />
  );
};

// CourseDetailsList component - expanded course details view (matching old StudyOverview layout)
const CourseDetailsList = ({ courses, selectedSemester, hoveredCourse }) => {
  const currentSemester = useCurrentSemester();
  const filteredCourses = filterCoursesForSemester(
    courses || [],
    selectedSemester,
    currentSemester
  );

  const sortedCourses = sortCoursesByType(filteredCourses);

  const isHovered = (course) =>
    hoveredCourse &&
    hoveredCourse.name === course.name &&
    hoveredCourse.type === course.type;

  return (
    <div className="mt-4">
      <div className="py-2 pl-2 text-l font-bold bg-gray-100 rounded">
        Overview {removeSpacesFromSemesterName(selectedSemester)}
      </div>
      <div className="mt-2">
        {sortedCourses.map((course, idx) => {
          const isEnriched = course.isEnriched !== false; // Default to true for existing courses

          return (
            <div
              key={idx}
              className={`px-4 py-2 rounded grid grid-cols-10 gap-4 text-sm
                ${isHovered(course) ? "bg-gray-200" : ""}
                ${!isEnriched ? "bg-gray-50" : ""}
                transition-colors duration-200`}
            >
              <div
                className={`col-span-4 font-semibold truncate ${
                  !isEnriched ? "text-gray-500" : ""
                }`}
              >
                {course.name}
                {!isEnriched && (
                  <span className="ml-2 text-xs text-gray-500 animate-pulse">
                    Loading...
                  </span>
                )}
              </div>
              <div className="col-span-3 truncate">
                {course.type.replace("-wishlist", "")}
                {course.type.endsWith("-wishlist") && (
                  <span className="ml-1 text-orange-500 inline-flex items-center">
                    <LockClosed className="w-3 h-3" />
                  </span>
                )}
              </div>
              <div className="text-center">{course.credits} ECTS</div>
              <div className="text-center col-span-2">
                {typeof course.grade === "number"
                  ? course.grade.toFixed(2)
                  : "N/A"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ProgramSummaryRow component - credits summary display (matching original format)
const ProgramSummaryRow = ({ program, rawScorecard }) => {
  // Extract credits from raw scorecard like the original
  const programTotalRequired = rawScorecard?.items?.[0]?.maxCredits
    ? parseFloat(rawScorecard.items[0].maxCredits)
    : 0;
  const programEarned = rawScorecard?.items?.[0]?.sumOfCredits
    ? parseFloat(rawScorecard.items[0].sumOfCredits)
    : 0;
  const programRemaining = Math.max(0, programTotalRequired - programEarned);

  return (
    <div className="p-2 flex flex-col items-end text-right">
      <div className="font-semibold">
        Earned ECTS:{" "}
        <span className="text-black-800">
          {programEarned.toFixed(2)} / {programTotalRequired.toFixed(2)}
        </span>
      </div>
      <div className="font-semibold">
        Remaining ECTS:{" "}
        <span className="text-black-800">{programRemaining.toFixed(2)}</span>
      </div>
    </div>
  );
};

// Main ProgramOverview component
const ProgramOverview = ({
  program,
  semesters,
  selectedSemester,
  setSelectedSemester,
  rawScorecard,
}) => {
  const [hoveredCourse, setHoveredCourse] = useState(null);
  const currentSemester = useCurrentSemester();

  // Pre-filter semesters to remove wishlist courses for past semesters (same as original)
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

  // Calculate max semester credits (same as original)
  const maxSemesterCredits = useMemo(() => {
    return Math.max(
      ...Object.values(filteredSemesters).map((courses) =>
        calculateSemesterCredits(courses)
      )
    );
  }, [filteredSemesters]);

  // Sort semesters (same as original)
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