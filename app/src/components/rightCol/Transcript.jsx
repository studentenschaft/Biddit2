// Transcript.jsx
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSetRecoilState, useRecoilValue, useRecoilState } from 'recoil';
import { authTokenState } from '../recoil/authAtom';
import { currentEnrollmentsState } from '../recoil/currentEnrollmentsAtom';
import { mainProgramScorecardSelector } from '../recoil/mainProgramScorecardSelector';
import { mergedScorecardDataSelector } from '../recoil/mergedScorecardDataSelector';
import { useInitializeScoreCards } from '../helpers/useInitializeScorecards';
import { fetchCurrentEnrollments } from '../recoil/ApiCurrentEnrollments';
import { useErrorHandler } from '../errorHandling/useErrorHandler';
import { ScorecardErrorMessage } from '../errorHandling/ScorecardErrorMessage';
import GradeTranscript from './GradeTranscript';
import LoadingText from '../common/LoadingText';
import { LoadingSkeletonTranscript } from './LoadingSkeletons';
import { useMergeWishlistedCourses } from "../helpers/useMergeWishlistedCourses";
import { useCurrentSemester } from "../helpers/studyOverviewHelpers";
import { coursesWithTypesSelector } from "../recoil/coursesWithTypesSelector";
import { selectedCourseIdsAtom } from '../recoil/selectedCourseIdsAtom';

// Import study plan state and API delete function to support clearing saved courses
import { studyPlanAtom } from '../recoil/studyPlanAtom';
import { deleteCourse } from '../helpers/api';

/**
 * Transcript component displays the student's grade transcript and merges in any wishlisted courses.
 * It also provides a button at the bottom to clear all saved courses from the backend.
 */
const Transcript = () => {
  // Error handling hook to manage and report errors.
  const handleError = useErrorHandler();
  const [scorecardError, setScorecardError] = useState(false);

  // Retrieve the official transcript data from Recoil state.
  const mainProgramData = useRecoilValue(mainProgramScorecardSelector);
  // Initialize scorecards when the component mounts.
  useInitializeScoreCards(handleError);

  // State to manage loading status for enrollment data.
  const [isLoading, setIsLoading] = useState(true);
  const authToken = useRecoilValue(authTokenState);
  const currentEnrollments = useRecoilValue(currentEnrollmentsState);
  const setCurrentEnrollments = useSetRecoilState(currentEnrollmentsState);

  // Retrieve merged scorecard data which includes enriched data from wishlisted courses.
  const mergedScorecards = useRecoilValue(mergedScorecardDataSelector);

  // Retrieve additional wishlist-related data.
  const currentSemester = useCurrentSemester();
  const categoryTypeMap = useRecoilValue(coursesWithTypesSelector);
  // Trigger side effects related to merging wishlisted courses.
  useMergeWishlistedCourses(authToken, currentSemester, categoryTypeMap, handleError);

  const [selectedCourseIds, setSelectedCourseIds] = useRecoilState(selectedCourseIdsAtom);

  /**
   * Compute wishlist courses directly within the Transcript component.
   * This logic extracts courses from the merged scorecard data where the course type ends with "-wishlist"
   * and annotates them with their corresponding semester label.
   */
  const wishlistCourses = useMemo(() => {
    if (!mergedScorecards || !currentEnrollments) {
      console.debug("Wishlist courses: Dependencies not ready");
      return [];
    }
    // Identify the main study enrollment.
    const mainStudy = currentEnrollments.enrollmentInfos?.find(
      (enrollment) => enrollment.isMainStudy
    );
    if (!mainStudy) {
      console.debug("Wishlist courses: No main study found");
      return [];
    }
    // Use the main study's program description as the key to access program-specific data.
    const programKey = mainStudy.studyProgramDescription;
    const semesterKeyedData = mergedScorecards[programKey];
    if (!semesterKeyedData) {
      console.warn("Wishlist courses: No program data found for key:", programKey);
      return [];
    }
    // Collect wishlist courses from each semester and annotate with the semester label.
    let wishlist = [];
    Object.entries(semesterKeyedData).forEach(([semesterLabel, courses]) => {
      courses.forEach((course) => {
        if (course.type && course.type.endsWith("-wishlist")) {
          wishlist.push({
            ...course,
            semester: semesterLabel,
          });
        }
      });
    });
    console.log("Wishlist courses computed:", wishlist);
    return wishlist;
  }, [mergedScorecards, currentEnrollments]);

  /**
   * Helper: Build a mapping from a cleaned wishlist course type to an array of courses.
   * For example, a course with type "math-wishlist" will be mapped under "math".
   */
  const buildWishlistMapping = useCallback((wishlistCourses) => {
    return wishlistCourses.reduce((acc, course) => {
      // Remove the '-wishlist' suffix (if present) and trim whitespace.
      const cleanType = course.type.replace(/-wishlist$/i, "").trim();
      if (!acc[cleanType]) {
        acc[cleanType] = [];
      }
      acc[cleanType].push(course);
      return acc;
    }, {});
  }, []);

  /**
   * Helper: Recursively traverse the transcript and merge in wishlist courses into matching categories.
   * The transcript is deep cloned to avoid direct mutations.
   */
  const mergeWishlistIntoTranscript = useCallback((transcript, wishlistCourses) => {
    // Deep clone the transcript (assuming it is JSON-serializable).
    const mutableTranscript = JSON.parse(JSON.stringify(transcript));
    const wishlistMap = buildWishlistMapping(wishlistCourses);

    // Recursive function to traverse transcript items.
    function traverse(items) {
      if (!Array.isArray(items)) return;
      items.forEach((item) => {
        // Check if the item is a category (title).
        if (item.isTitle) {
          const categoryName = (item.shortName || item.description || "").trim();
          // For each wishlist category, check if it belongs in this transcript section.
          Object.keys(wishlistMap).forEach((key) => {
            const normalizedCategoryName = categoryName.trim().toLowerCase();
            const normalizedKey = key.trim().toLowerCase();

            if (
              normalizedCategoryName === normalizedKey ||
              normalizedCategoryName === normalizedKey + "s"
            ) {
              // Ensure the category has an items array.
              if (!item.items) {
                item.items = [];
              }
              // Append each wishlisted course as a new course item.
              wishlistMap[key].forEach((course) => {
                const newCourseItem = {
                  achievementLanguage: "EN",
                  isDetail: true,
                  isTitle: false,
                  mark: "",
                  maxCredits: "0.00",
                  minCredits: "0.00",
                  mncp: "0.00",
                  scoreCardMask: 322,
                  semester: course.semester,
                  studyPlanMainFocus: null,
                  sumOfCredits: course.credits.toString(),
                  fulfillmentTypeId: 0,
                  description: course.name,
                  id: course.id,
                  shortName: course.name,
                  isWishlist: true,
                };
                item.items.push(newCourseItem);
              });
            }
          });
        }
        // Recursively process nested items.
        if (item.items && item.items.length > 0) {
          traverse(item.items);
        }
      });
    }

    traverse(mutableTranscript.items);
    return mutableTranscript;
  }, [buildWishlistMapping]);

  // Compute the merged transcript using useMemo to avoid unnecessary recalculations.
  const mergedTranscript = useMemo(() => {
    if (mainProgramData && wishlistCourses) {
      return mergeWishlistIntoTranscript(mainProgramData, wishlistCourses);
    }
    return null;
  }, [mainProgramData, wishlistCourses, mergeWishlistIntoTranscript]);

  // Fetch current enrollment data when the auth token changes.
  useEffect(() => {
    if (!authToken) return;

    const fetchEnrollments = async () => {
      setIsLoading(true);
      try {
        const currentEnrollmentsData = await fetchCurrentEnrollments(authToken);
        setCurrentEnrollments(currentEnrollmentsData);
      } catch (error) {
        console.error('Error fetching enrollments:', error);
        // Set error state to render an error message.
        setScorecardError(true);
        handleError(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEnrollments();
  }, [authToken, setCurrentEnrollments, handleError]);

  // Import study plan from Recoil to support clearing saved courses.
  const [studyPlan, setStudyPlan] = useRecoilState(studyPlanAtom);

  /**
   * Handler to clear all saved courses from the backend.
   * It confirms the action with the user and then iterates over the current study plan's courses,
   * calling deleteCourse for each saved course. Upon success, it clears the courses from the local study plan state.
   */
  const handleClearCourses = async () => {
    if (!window.confirm("Are you sure you want to clear all saved courses? You have to add all courses to your wishlist again.")) {
      return;
    }
    // Ensure we have a study plan and a current plan with saved courses.
    if (!studyPlan || !studyPlan.currentPlan || !studyPlan.currentPlan.courses || studyPlan.currentPlan.courses.length === 0) {
      alert("No saved courses found to clear.");
      return;
    }
    const courseIds = studyPlan.currentPlan.courses;
    try {
      // Iterate over each saved course and call the deleteCourse API.
      for (const courseId of courseIds) {
        await deleteCourse(studyPlan.currentPlan.id, courseId, authToken);
      }
      // Update local study plan state to reflect that all courses have been cleared.
      setStudyPlan(prev => ({
        ...prev,
        currentPlan: { ...prev.currentPlan, courses: [] }
      }));
      alert("All saved courses have been cleared - refreshing the page now.");
      // Force a full page refresh
      window.location.reload();
    } catch (error) {
      console.error("Error clearing saved courses:", error);
      handleError(error);
    }
  };

  // If an error occurred, display the error message.
  if (scorecardError) {
    return <ScorecardErrorMessage />;
  }

  // Display a loading state while enrollment or transcript data is not available.
  if (isLoading || !currentEnrollments || !mainProgramData) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Transcript / Scorecard</h1>
        <div className="w-full space-y-4 animate-pulse">
          <LoadingText>Loading enrollment data...</LoadingText>
          <LoadingSkeletonTranscript />
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Transcript / Scorecard</h1>
      <GradeTranscript 
    scorecardDetails={mergedTranscript || mainProgramData}
    semesterShortName={currentSemester}   // or the appropriate semester value
    authToken={authToken}
    selectedCourseIds={selectedCourseIds}        // ensure this comes from your Recoil state
    setSelectedCourseIds={setSelectedCourseIds}    // likewise from Recoil
/>
      {/* Button to clear all saved courses from the backend */}
      <div className="mt-6 text-center">
        <button
          title="Click to remove all saved courses from the backend. Use this when you need to clean up courses that can’t be removed through normal actions."
          onClick={handleClearCourses}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 active:bg-red-800 transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 whitespace-nowrap text-xs md:text-sm"
        >
          Clear All Saved Courses
        </button>
      </div>
    </div>
  );
};

export { Transcript };