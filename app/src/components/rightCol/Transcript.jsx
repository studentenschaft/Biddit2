// Transcript.jsx
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSetRecoilState, useRecoilValue, useRecoilState } from 'recoil';
import { authTokenState } from '../recoil/authAtom';
import { currentEnrollmentsState } from '../recoil/currentEnrollmentsAtom';
import { useErrorHandler } from '../errorHandling/useErrorHandler';
import { ScorecardErrorMessage } from '../errorHandling/ScorecardErrorMessage';
import GradeTranscript from './GradeTranscript';
import LoadingText from '../common/LoadingText';
import { LoadingSkeletonTranscript } from './LoadingSkeletons';
import { selectedCourseIdsAtom } from '../recoil/selectedCourseIdsAtom';

// Import unified data system
import { 
  academicDataInitializationSelector,
  currentProgramDataSelector,
  mainProgramStudyPlanSelector
} from '../recoil/unifiedAcademicDataSelectors';
import { unifiedAcademicDataState, initializedProgramsState } from '../recoil/unifiedAcademicDataAtom';
import { useCurrentSemester } from '../helpers/studyOverviewHelpers';
import { useInitializeScoreCards } from '../helpers/useInitializeScorecards';
import { useUnifiedDataBridge } from '../helpers/useUnifiedDataBridge';
import { scorecardDataState } from '../recoil/scorecardsAllRawAtom';


// Import study plan state and API delete function to support clearing saved courses
import { studyPlanAtom } from '../recoil/studyPlanAtom';
import { deleteCourse } from '../helpers/api';

/**
 * Transcript component displays the student's grade transcript and merges in any wishlisted courses.
 * It also provides a button at the bottom to clear all saved courses from the backend.
 * 
 * This component uses our unified academic data system for better performance and consistency.
 */
const Transcript = () => {
  // Error handling hook to manage and report errors.
  const handleError = useErrorHandler();
  const [scorecardError, setScorecardError] = useState(false);

  // Use unified data system
  const academicData = useRecoilValue(unifiedAcademicDataState);
  const initStatus = useRecoilValue(academicDataInitializationSelector);
  const currentProgramData = useRecoilValue(currentProgramDataSelector);
  const mainProgramStudyPlan = useRecoilValue(mainProgramStudyPlanSelector);
  const scorecardData = useRecoilValue(scorecardDataState);
  const sourceStudyPlan = useRecoilValue(studyPlanAtom); // For debugging bridge data source
  
  const authToken = useRecoilValue(authTokenState);
  const currentEnrollments = useRecoilValue(currentEnrollmentsState);
  const [selectedCourseIds, setSelectedCourseIds] = useRecoilState(selectedCourseIdsAtom);
  
  // Get current semester for UI
  const currentSemester = useCurrentSemester();
  
  // Initialize scorecard data (needed for unified system)
  useInitializeScoreCards(handleError);
  
  // Use unified data bridge that leverages EventListContainer's existing study plan data
  useUnifiedDataBridge('Transcript', handleError);
  

  /**
   * Get wishlist courses from unified academic data system.
   * Uses the same data source as StudyOverview for consistency.
   * This includes both study-plans API data AND local selections.
   */
  const wishlistCourses = useMemo(() => {
    if (!mainProgramStudyPlan || Object.keys(mainProgramStudyPlan).length === 0) {
      return [];
    }
    
    // 🔍 DEBUG: Transcript wishlist data
    console.log("📜 Transcript Wishlist Source:", {
      mainProgramStudyPlanKeys: Object.keys(mainProgramStudyPlan),
      mainProgramStudyPlan: mainProgramStudyPlan,
      totalCoursesInStudyPlan: Object.values(mainProgramStudyPlan).flat().length
    });
    
    // Collect wishlist courses from unified study plan data (same as StudyOverview)
    let wishlist = [];
    
    Object.entries(mainProgramStudyPlan).forEach(([semesterLabel, courses]) => {
      if (!Array.isArray(courses)) {
        return;
      }
      
      courses.forEach((course) => {
        // Include ALL courses from study plan (they should all be wishlist)
        // AND courses without grades (these are planned/wishlist courses)
        if (course.type?.endsWith('-wishlist') || !course.grade) {
          const wishlistCourse = {
            ...course,
            semester: semesterLabel,
            type: course.type || `${course.big_type || 'elective'}-wishlist`,
          };
          
          wishlist.push(wishlistCourse);
        }
      });
    });
    
    return wishlist;
  }, [mainProgramStudyPlan]);

  /**
   * Helper: Build a mapping from a cleaned wishlist course type to an array of courses.
   * For example, a course with type "math-wishlist" will be mapped under "math".
   */
  const buildWishlistMapping = useCallback((wishlistCourses) => {
    const mapping = wishlistCourses.reduce((acc, course) => {
      // Use big_type instead of type for category matching (e.g., "elective", "core", "contextual")
      const categoryType = course.big_type || 'elective';
      if (!acc[categoryType]) {
        acc[categoryType] = [];
      }
      acc[categoryType].push(course);
      return acc;
    }, {});
    
    return mapping;
  }, []);

  /**
   * Helper: Recursively traverse the transcript and merge in wishlist courses into matching categories.
   * The transcript is deep cloned to avoid direct mutations.
   */
  const mergeWishlistIntoTranscript = useCallback((transcript, wishlistCourses) => {
    // Deep clone the transcript (assuming it is JSON-serializable)
    const mutableTranscript = JSON.parse(JSON.stringify(transcript));
    const wishlistMap = buildWishlistMapping(wishlistCourses);

    // Recursive function to traverse transcript items
    function traverse(items) {
      if (!Array.isArray(items)) return;
      
      items.forEach((item) => {
        // Check if the item is a category (title)
        if (item.isTitle) {
          const categoryName = (item.shortName || item.description || "").trim();
          
          // For each wishlist category, check if it belongs in this transcript section
          Object.keys(wishlistMap).forEach((key) => {
            const normalizedCategoryName = categoryName.trim().toLowerCase();
            const normalizedKey = key.trim().toLowerCase();

            if (
              normalizedCategoryName === normalizedKey ||
              normalizedCategoryName === normalizedKey + "s"
            ) {
              // Ensure the category has an items array
              if (!item.items) {
                item.items = [];
              }
              
              // Append each wishlisted course as a new course item
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
                  sumOfCredits: course.credits?.toString() || "0.00",
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
        // Recursively process nested items
        if (item.items && item.items.length > 0) {
          traverse(item.items);
        }
      });
    }

    traverse(mutableTranscript.items);
    
    return mutableTranscript;
  }, [buildWishlistMapping]);


  // Get main program transcript data from unified system
  const mainProgramTranscript = useMemo(() => {
    return currentProgramData?.transcript?.rawScorecard || null;
  }, [currentProgramData]);

  // Compute the merged transcript using useMemo to avoid unnecessary recalculations
  const mergedTranscript = useMemo(() => {
    if (mainProgramTranscript && wishlistCourses.length > 0) {
      return mergeWishlistIntoTranscript(mainProgramTranscript, wishlistCourses);
    }
    
    return null;
  }, [mainProgramTranscript, wishlistCourses, mergeWishlistIntoTranscript]);


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

  // Display a loading state while unified data is not available
  const isLoading = !initStatus.isInitialized || !currentProgramData || !mainProgramTranscript;
  
  if (isLoading) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Transcript / Scorecard</h1>
        <div className="w-full space-y-4 animate-pulse">
          <LoadingText>Loading transcript data...</LoadingText>
          <LoadingSkeletonTranscript />
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Transcript / Scorecard</h1>
      <GradeTranscript 
        scorecardDetails={mergedTranscript || mainProgramTranscript}
        semesterShortName={currentSemester}
        authToken={authToken}
        selectedCourseIds={selectedCourseIds}
        setSelectedCourseIds={setSelectedCourseIds}
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