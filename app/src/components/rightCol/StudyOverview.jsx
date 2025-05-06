/**
 * StudyOverview.jsx
 *
 * This component provides an overview of the user's study progress, including their enrolled programs,
 * semesters, courses, and credits. It fetches data from various APIs, processes and transforms the data,
 * and renders it in a structured, interactive UI.
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRecoilValue, useSetRecoilState, useRecoilState } from "recoil";
import { authTokenState } from "../recoil/authAtom";
import { currentEnrollmentsState } from "../recoil/currentEnrollmentsAtom";
import LoadingText from "../common/LoadingText";
import { LockClosed } from "../leftCol/bottomRow/LockClosed";
import { fetchCurrentEnrollments } from "../recoil/ApiCurrentEnrollments";
import { useErrorHandler } from "../errorHandling/useErrorHandler";
import { ScorecardErrorMessage } from "../errorHandling/ScorecardErrorMessage";
import PropTypes from "prop-types";
import { selectedTabAtom } from "../recoil/selectedTabAtom";
import { useInitializeScoreCards } from "../helpers/useInitializeScorecards";
import { scorecardDataState } from "../recoil/scorecardsAllRawAtom";
import { transformedScorecardsSelector } from "../recoil/transformedScorecardsSelector";
import { mergedScorecardBySemesterAtom } from "../recoil/mergedScorecardBySemesterAtom";
import { mergedOverviewSelector } from "../recoil/mergedOverviewSelector";
import { LoadingSkeletonStudyOverview } from "./LoadingSkeletons";

import { allCourseInfoState } from "../recoil/allCourseInfosSelector";


import { enrolledCoursesState } from '../recoil/enrolledCoursesAtom';
import {
  useCurrentSemester,
  getTypeColor,
  removeSpacesFromSemesterName,
  isSemesterInPast,
  filterCoursesForSemester,
  calculateSemesterCredits,
  sortCoursesByType,
} from "../helpers/studyOverviewHelpers";
import { coursesWithTypesSelector } from "../recoil/coursesWithTypesSelector";
import { useMergeWishlistedCourses } from "../helpers/useMergeWishlistedCourses";

/**
 * Main component that renders the study overview page.
 * It displays the user's enrolled programs, semesters, courses, and credits.
 * Wishlist merging is now handled via the useMergeWishlistedCourses hook to avoid duplicate logic.
 */
const StudyOverview = () => {
  // Retrieve global state and error handler.
  const authToken = useRecoilValue(authTokenState);
  const currentEnrollments = useRecoilValue(currentEnrollmentsState);
  const handleError = useErrorHandler();
  const setCurrentEnrollments = useSetRecoilState(currentEnrollmentsState);
  const [enrolledCourses, setEnrolledCourses] = useRecoilState(enrolledCoursesState);
  const [scorecardError, setScorecardError] = useState(false);

  // Retrieve current semester and wishlist mapping.
  const currentSemester = useCurrentSemester();
  const categoryTypeMap = useRecoilValue(coursesWithTypesSelector);

  // Initialize scorecards on mount.
  useInitializeScoreCards(handleError);
  const scorecardData = useRecoilValue(scorecardDataState);

  // Local state for the selected semester.
  const [selectedSemester, setSelectedSemester] = useState(null);
  const handleSetSelectedSemester = useCallback(
    (semester) => setSelectedSemester(semester),
    []
  );

  // Fetch current enrollments if not already loaded.
  useEffect(() => {
    if (!authToken) return;
    if (currentEnrollments) return; // Already loaded.
    (async () => {
      try {
        const data = await fetchCurrentEnrollments(authToken);
        setCurrentEnrollments(data);
      } catch (error) {
        console.error("Error fetching enrollments:", error);
        handleError(error);
      }
    })();
  }, [authToken, currentEnrollments, setCurrentEnrollments, handleError]);

  // Trigger merging of wishlisted courses via the custom hook.
  useMergeWishlistedCourses(authToken, currentSemester, categoryTypeMap, handleError);

  // Retrieve the merged scorecard data from Recoil.
  const mergedScorecardBySemester = useRecoilValue(mergedScorecardBySemesterAtom);

  // Determine if wishlist merging is in progress.
  const baseSemesterKeyedScorecards = useRecoilValue(transformedScorecardsSelector);
  const isMergingWishlist =
    !mergedScorecardBySemester &&
    baseSemesterKeyedScorecards &&
    Object.keys(baseSemesterKeyedScorecards).length > 0;

  // Retrieve final display data derived from the merged scorecards.
  const finalDisplayData = useRecoilValue(mergedOverviewSelector);



  // ----- Merge enrolledCourses into the final display data -----
  // Get current semester outside of useMemo
  const currentSem = useCurrentSemester();

  const allCourseInfo = useRecoilValue(allCourseInfoState);
  
  // Use data from allCourseInfoState instead of manually merging enrollments
const finalDisplayDataWithEnrolled = useMemo(() => {
  if (!finalDisplayData || !allCourseInfo) return finalDisplayData;
  
  // Early return if no enrolled courses
  const currentSemesterIndex = "1";
  const currentEnrolledCourses = allCourseInfo[currentSemesterIndex]?.filter(
    course => course.enrolled
  ) || [];
  
  if (currentEnrolledCourses.length === 0) {
    return finalDisplayData; // No enrolled courses to add
  }
  
  // Create a map for quick lookup
  const updated = JSON.parse(JSON.stringify(finalDisplayData));
  
  // Pre-format all enrolled courses once
  const enrolledCoursesFormatted = currentEnrolledCourses.map((course) => ({
    name: course.shortName || course.eventDescription,
    credits: course.credits / 100, 
    type: course.classification || "core",
    courseId: course.id,
    courseNumber: course.courseNumber,
    description: course.eventDescription,
    eventCourseNumber: course.eventCourseNumber,
    languageId: course.languageId
  }));
  
  // Create a lookup set for faster duplicate checking
  const existingCourseIds = new Set();
  const existingCourseNames = new Set();
  
  // Iterate through each program
  Object.keys(updated).forEach((program) => {
    // Find the semester that matches the current semester
    const semesterKeys = Object.keys(updated[program]);
    const currentSemesterKey = semesterKeys.find(
      (semKey) => removeSpacesFromSemesterName(semKey) === removeSpacesFromSemesterName(currentSem)
    );
    
    if (currentSemesterKey) {
      if (!updated[program][currentSemesterKey]) {
        updated[program][currentSemesterKey] = [];
      }
      
      // Collect existing course IDs and names for fast lookups
      updated[program][currentSemesterKey].forEach(course => {
        if (course.courseId) existingCourseIds.add(course.courseId);
        if (course.name) existingCourseNames.add(course.name);
      });
      
      // Add non-duplicate courses
      enrolledCoursesFormatted.forEach((newCourse) => {
        if (!existingCourseIds.has(newCourse.courseId) && 
            !existingCourseNames.has(newCourse.name)) {
          updated[program][currentSemesterKey].push(newCourse);
        }
      });
    }
  });
  
  return updated;
}, [finalDisplayData, allCourseInfo, currentSem]);



  
  // Set error state if scorecard data contains an error.
  useEffect(() => {
    if (scorecardData.error) {
      setScorecardError(true);
    }
  }, [scorecardData.error]);

  // Debug: Log merged scorecard data.
  useEffect(() => {
    console.log("mergedScorecardBySemesterAtom inspection", mergedScorecardBySemester);
  }, [mergedScorecardBySemester]);

  // Identify the main study program description.
  let mainStudyDescription = null;
  if (currentEnrollments?.isLoaded && currentEnrollments?.enrollmentInfos) {
    const mainStudy = currentEnrollments.enrollmentInfos.find(
      (info) => info.isMainStudy
    );
    if (mainStudy) {
      mainStudyDescription = mainStudy.studyProgramDescription;
    }
  }

  useEffect(() => {
    console.log("Debug enrolled: currentEnrollments", currentEnrollments);
  }, [currentEnrollments]);
  useEffect(() => {
    console.log("Debug enrolled: enrolledCourses (Atom)", enrolledCourses);
  }, [enrolledCourses]);

  

  // Sort programs to prioritize the main study.
  const sortedScorecardsEntries = useMemo(() => {
    const entries = Object.entries(finalDisplayDataWithEnrolled);
    if (mainStudyDescription) {
      entries.sort(([progA], [progB]) => {
        if (progA === mainStudyDescription) return -1;
        if (progB === mainStudyDescription) return 1;
        return 0;
      });
    }
    return entries;
  }, [finalDisplayDataWithEnrolled, mainStudyDescription]);

  if (scorecardError) {
    return <ScorecardErrorMessage />;
  }

  return (
    <div className="flex flex-col px-8 py-4">
      <h1 className="text-2xl font-bold mb-4">Study Overview</h1>

      {/* Display loading spinner if scorecard data is loading or wishlist merge is in progress */}
      {(!scorecardData || scorecardData.loading || isMergingWishlist) && (
        <div className="mb-6">
          <LoadingText>Loading your saved courses...</LoadingText>
          <LoadingSkeletonStudyOverview />
        </div>
      )}

      {/* Show message if no scorecard data is available after loading */}
      {scorecardData &&
        !scorecardData.loading &&
        !isMergingWishlist &&
        Object.keys(finalDisplayData).length === 0 && (
          <div>No scorecard data found.</div>
        )}

      {/* Iterate over programs and render each program section */}
      {sortedScorecardsEntries.map(([program, semesters], index, array) => (
        <div key={program}>
          <ProgramSection
            program={program}
            semesters={semesters}
            selectedSemester={selectedSemester}
            setSelectedSemester={handleSetSelectedSemester}
          />
          {index < array.length - 1 && (
            <div className="my-8 h-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
          )}
        </div>
      ))}
    </div>
  );
};

/**
 * Component representing a section for each enrolled program.
 * @param {Object} props - Component properties.
 * @param {string} props.program - The study program name.
 * @param {Object} props.semesters - The semesters and corresponding courses.
 * @param {string} props.selectedSemester - The currently selected semester.
 * @param {function} props.setSelectedSemester - Function to update the selected semester.
 */
const ProgramSection = ({
  program,
  semesters,
  selectedSemester,
  setSelectedSemester,
}) => {
  const [hoveredCourse, setHoveredCourse] = useState(null);
  const currentSemester = useCurrentSemester();

  // Pre-filter semesters to remove wishlist courses for past semesters.
  const filteredSemesters = useMemo(() => {
    return Object.entries(semesters).reduce((acc, [semester, courses]) => {
      if (!courses) return acc;
      const filteredCourses = isSemesterInPast(
        removeSpacesFromSemesterName(semester),
        removeSpacesFromSemesterName(currentSemester)
      )
        ? courses.filter((course) => course.type !== "wishlist")
        : courses;
      acc[semester] = filteredCourses;
      return acc;
    }, {});
  }, [semesters, currentSemester]);

  // Calculate the maximum credits across semesters for UI scaling.
  const maxSemesterCredits = useMemo(() => {
    return Math.max(
      ...Object.values(filteredSemesters).map((courses) =>
        calculateSemesterCredits(courses)
      )
    );
  }, [filteredSemesters]);

  const getSemesterSortValue = useCallback((semester) => {
    const isSpring = semester.startsWith('FS');
    const isFall = semester.startsWith('HS');
    if (!isSpring && !isFall) return 0;

    const year = semester.slice(2);
    return parseInt(year) * 2 + (isFall ? 1 : 0);
  }, []);

  // Add new memoized sorted semesters
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
          hoveredCourse={hoveredCourse}
          setHoveredCourse={setHoveredCourse}
          maxSemesterCredits={maxSemesterCredits}
        /> 
        

        <div className="mt-2 flex flex-col items-end text-right">
          <ProgramSummaryRow program={program} semesters={semesters} />
        </div>
      </div>
      
      {selectedSemester && (
        <CourseDetailsList
          courses={semesters[selectedSemester]}
          selectedSemester={selectedSemester}
          hoveredCourse={hoveredCourse}
        />
      )}

      {/* Type legend (unchanged) */}
      <div className="flex flex-row items-center justify-center w-full pt-4 flex-wrap gap-4">
        {["core", "elective", "contextual"].map((type) => (
          <div key={type} className="flex items-center text-xs md:text-sm">
            <div className={`h-4 w-4 rounded mx-1 ${getTypeColor({ type })}`} />
            <div className="capitalize">{type}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Renders a list of semesters for a given program.
 * @param {Object} props - Component properties.
 */
const SemesterList = ({
  sortedSemesters,
  selectedSemester,
  setSelectedSemester,
  hoveredCourse,
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

/**
 * Renders a single row representing one semester.
 */
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

  // Sort courses by type
  const sortedCourses = sortCoursesByType(courses || []);

  // Calculate average grade for courses.
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
        // Only update selected semester if it's different to avoid redundant renders
        if (selectedSemester !== semester) {
          setSelectedSemester(semester);
        }
      }}
    >
      <div
        className={`col-span-2 md:col-span-1 font-semibold cursor-pointer ${
          selectedSemester === semester ? "text-green-800" : ""
        }`}
      >
        {semester}
      </div>

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

      <div className="col-span-4 md:col-span-3 grid grid-cols-2 gap-2 items-center text-sm font-semibold">
        <div className="text-right whitespace-nowrap">
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
        {isCurrentSemester ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTab(2); // Example: switch to the “Current Semester” tab
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
          <div className="text-center">
            {avgGrade ? avgGrade.toFixed(2) : "N/A"}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * A small bar representing a single course in a semester.
 */
const CourseBar = ({ course, setHoveredCourse, maxSemesterCredits }) => (
  <div
    className={`h-full m-0.5 md:m-1 rounded flex items-center justify-center text-white
      ${getTypeColor(course)}
      transition-all duration-200
      hover:shadow-lg hover:scale-y-105`}
    style={{
      width: `${(course.credits / maxSemesterCredits) * 100}%`,
      minWidth: "0.25rem",
    }}
    onMouseEnter={() => setHoveredCourse(course)}
    onMouseLeave={() => setHoveredCourse(null)}
  />
);

/**
 * Component that renders the detailed list of courses for a selected semester.
 */
const CourseDetailsList = ({ courses, selectedSemester, hoveredCourse }) => {
  const currentSemester = useCurrentSemester();
  const filteredCourses = filterCoursesForSemester(
    courses || [],
    selectedSemester,
    currentSemester
  );

  // Sort courses by type
  const sortedCourses = sortCoursesByType(filteredCourses);

  const isHovered = (course) =>
    hoveredCourse &&
    hoveredCourse.name === course.name &&
    hoveredCourse.type === course.type;

  return (
    <div className="mt-4">
      <div className="py-2 pl-2 text-l font-bold bg-gray-100 rounded">
        Overview {selectedSemester}
      </div>
      <div className="mt-2">
        {sortedCourses.map((course, idx) => (
          <div
            key={idx}
            className={`px-4 py-2 rounded grid grid-cols-10 gap-4 text-sm
              ${isHovered(course) ? "bg-gray-200" : ""}
              transition-colors duration-200`}
          >
            <div className="col-span-4 font-semibold truncate">
              {course.name}
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
              {typeof course.grade === "number" ? course.grade.toFixed(2) : "N/A"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ProgramSummaryRow = ({ program, semesters }) => {
  // Grab the raw scorecard data from Recoil so we can read total/earned credits
  const scorecardData = useRecoilValue(scorecardDataState);

  // Find the raw scorecard object for this program
  const rawScorecard = scorecardData?.rawScorecards
    ? scorecardData.rawScorecards[program]
    : null;

  // Extract total required (maxCredits) and total earned (sumOfCredits) from raw scorecard
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

export default StudyOverview;

/**
 * PROPTYPES
 */
const courseShape = PropTypes.shape({
  name: PropTypes.string.isRequired,
  credits: PropTypes.number.isRequired,
  type: PropTypes.string.isRequired,
  grade: PropTypes.number,
});
const semestersShape = PropTypes.objectOf(PropTypes.arrayOf(courseShape));

ProgramSection.propTypes = {
  program: PropTypes.string.isRequired,
  semesters: semestersShape.isRequired,
  selectedSemester: PropTypes.string,
  setSelectedSemester: PropTypes.func.isRequired,
};

SemesterList.propTypes = {
  sortedSemesters: PropTypes.arrayOf(PropTypes.array).isRequired,
  selectedSemester: PropTypes.string,
  setSelectedSemester: PropTypes.func.isRequired,
  hoveredCourse: courseShape,
  setHoveredCourse: PropTypes.func.isRequired,
  maxSemesterCredits: PropTypes.number.isRequired,
};

SemesterRow.propTypes = {
  semester: PropTypes.string.isRequired,
  courses: PropTypes.arrayOf(courseShape).isRequired,
  selectedSemester: PropTypes.string,
  setSelectedSemester: PropTypes.func.isRequired,
  setHoveredCourse: PropTypes.func.isRequired,
  maxSemesterCredits: PropTypes.number.isRequired,
};

CourseBar.propTypes = {
  course: courseShape.isRequired,
  setHoveredCourse: PropTypes.func.isRequired,
  maxSemesterCredits: PropTypes.number.isRequired,
};

CourseDetailsList.propTypes = {
  courses: PropTypes.arrayOf(courseShape).isRequired,
  selectedSemester: PropTypes.string.isRequired,
  hoveredCourse: courseShape,
};

ProgramSummaryRow.propTypes = {
  program: PropTypes.string.isRequired,
  semesters: PropTypes.object.isRequired, // shape: { [semesterName]: [arrayOfCourses] }
};