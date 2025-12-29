/**
 * Transcript.jsx
 * 
 * Transcript component displaying student's grade transcript with integrated wishlist courses
 * Uses unified data architecture (unifiedAcademicDataSelector) for clean, efficient data access
 * Provides 1:1 visual parity with original transcript while maintaining full functionality
 * Course removal synced with EventListContainer through GradeTranscript component
 */

import { useRecoilValue, useRecoilState } from 'recoil';
import { legacyAcademicDataSelector } from '../recoil/unifiedAcademicDataSelectors';
import { unifiedCourseDataState } from '../recoil/unifiedCourseDataAtom';
import { useScorecardFetching } from '../helpers/useScorecardFetching';
import { useUnifiedCourseLoader } from '../helpers/useUnifiedCourseLoader';
import { authTokenState } from '../recoil/authAtom';
import LoadingText from '../common/LoadingText';
import { LoadingSkeletonTranscript } from './LoadingSkeletons';
import { useState } from 'react';
import GradeTranscript from './GradeTranscript';
import React, { useMemo, useCallback } from 'react';
import { selectedCourseIdsAtom } from '../recoil/selectedCourseIdsAtom';
import { studyPlanAtom } from '../recoil/studyPlanAtom';
import { deleteCourse } from '../helpers/api';
import { useErrorHandler } from '../errorHandling/useErrorHandler';
import { ScorecardErrorMessage } from '../errorHandling/ScorecardErrorMessage';
import { useInitializeScoreCards } from '../helpers/useInitializeScorecards';
import { useCurrentSemester } from '../helpers/studyOverviewHelpers';
import { getMainProgramKey } from '../helpers/getMainProgram';

const Transcript = () => {
  // Use same data approach as StudyOverview (which works)
  const academicData = useRecoilValue(legacyAcademicDataSelector);
  const unifiedCourseData = useRecoilValue(unifiedCourseDataState);
  const authToken = useRecoilValue(authTokenState);
  const scorecardFetching = useScorecardFetching();
  const [fetchAttempted, setFetchAttempted] = useState(false);
  const [scorecardError] = useState(false);

  // Course data loading infrastructure (shared with StudyOverview)
  const {
    isLoading: isCourseLoading,
    isEnrichmentReady,
    hasEnrichmentDataForSemester,
    totalSemestersNeeded,
    termListObject
  } = useUnifiedCourseLoader(authToken, unifiedCourseData);
  
  
  // State needed for GradeTranscript component
  const [selectedCourseIds, setSelectedCourseIds] = useRecoilState(selectedCourseIdsAtom);
  const [studyPlan, setStudyPlan] = useRecoilState(studyPlanAtom);
  const handleError = useErrorHandler();
  
  // Get current semester for UI
  const currentSemester = useCurrentSemester();
  const currentSemesterIndex = 0;

  // Initialize scorecard data (needed for unified system)
  useInitializeScoreCards(handleError);
  
  
  // Get main program transcript data using memoization for performance
  const mainProgramTranscript = useMemo(() => {
    // Early return if academic data is not loaded
    if (!academicData.isLoaded) {
      return null;
    }
    
    const mainProgramKey = getMainProgramKey(academicData);
    if (!mainProgramKey) {
      return null;
    }
    
    const mainProgramData = academicData.transcriptView?.[mainProgramKey];
    if (!mainProgramData?.hierarchicalStructure || !Array.isArray(mainProgramData.hierarchicalStructure)) {
      return null;
    }
    
    const hierarchicalData = mainProgramData.hierarchicalStructure[0];
    if (!hierarchicalData) {
      return null;
    }
    
    return {
      items: [hierarchicalData]
    };
  }, [academicData.isLoaded, academicData.transcriptView, academicData.programs, totalSemestersNeeded]);
  
  // Helper function to normalize classification names to match transcript categories
  const normalizeClassification = useCallback((classification) => {
    if (!classification) return 'Electives';
    
    // Normalize common variations
    const normalized = classification.toLowerCase();
    
    if (normalized === 'elective' || normalized === 'electives') {
      return 'Electives';
    }
    
    // Keep original casing for complex classifications
    return classification;
  }, []);

  // Get wishlist courses from unified academic data
  const wishlistCourses = useMemo(() => {
    // Early return if academic data is not loaded
    if (!academicData.isLoaded) {
      return [];
    }
    
    const mainProgramKey = getMainProgramKey(academicData);
    console.log('🔍 [Transcript] Program selection and data:', {
      mainProgramKey,
      availablePrograms: Object.keys(academicData.programs || {}),
      hasStudyOverviewView: !!academicData.studyOverviewView?.[mainProgramKey]
    });
    
    console.log('🔍 [Transcript] Full academic data structure:', {
      isLoaded: academicData.isLoaded,
      hasPrograms: !!academicData.programs,
      hasTranscriptView: !!academicData.transcriptView,
      hasStudyOverviewView: !!academicData.studyOverviewView,
      topLevelKeys: Object.keys(academicData)
    });
    
    if (!mainProgramKey || !academicData.studyOverviewView?.[mainProgramKey]) {
      console.log('❌ [Transcript] No study overview data for main program');
      return [];
    }
    
    const studyOverviewData = academicData.studyOverviewView[mainProgramKey];
    let allWishlistCourses = [];
    
    // Collect selectedCourses from all semesters
    Object.entries(studyOverviewData).forEach(([semesterKey, semesterData]) => {
      if (semesterData.selectedCourses && Array.isArray(semesterData.selectedCourses)) {
        semesterData.selectedCourses.forEach(course => {
          allWishlistCourses.push({
            ...course,
            semester: semesterKey,
            classification: normalizeClassification(course.classification || course.type || 'elective')
          });
        });
      }
    });
    
    console.log('✅ [Transcript] Found', allWishlistCourses.length, 'wishlist courses for', mainProgramKey);
    return allWishlistCourses;
  }, [academicData.isLoaded, academicData.studyOverviewView, academicData.programs, normalizeClassification]);

  /**
   * Helper: Build a mapping from course classification to an array of courses.
   * Uses the same approach as original Transcript - directly using course.classification.
   */
  const buildWishlistMapping = useCallback((wishlistCourses) => {
    const mapping = wishlistCourses.reduce((acc, course) => {
      // Use classification directly, same as original Transcript
      const categoryType = course.classification || "elective";
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
   * Following the same logic as original Transcript component.
   */
  const mergeWishlistIntoTranscript = useCallback((transcript, wishlistCourses) => {
    if (!transcript || !wishlistCourses.length) {
      return transcript;
    }

    // Deep clone the transcript (assuming it is JSON-serializable)
    const mutableTranscript = JSON.parse(JSON.stringify(transcript));
    const wishlistMap = buildWishlistMapping(wishlistCourses);

    // Recursive function to traverse transcript items
    function traverse(items) {
      if (!Array.isArray(items)) return;

      items.forEach((item) => {
        // Check if the item is a category (title)
        if (item.isTitle) {
          // Match category with wishlist courses
          const possibleMatches = [
            item.classification,
            item.description,
            item.shortName,
            item.name
          ].filter(Boolean);
          
          let categoryWishlist = null;
          let matchedKey = null;
          
          // Try exact matches first
          for (const key of possibleMatches) {
            if (wishlistMap[key]) {
              categoryWishlist = wishlistMap[key];
              matchedKey = key;
              break;
            }
          }
          
          if (categoryWishlist && categoryWishlist.length > 0) {
            // Ensure items array exists
            if (!item.items) {
              item.items = [];
            }
            
            // Add wishlist and assigned courses to this category, transforming to transcript format
            categoryWishlist.forEach(course => {
              item.items.push({
                // Transform to match transcript data structure
                achievementLanguage: "EN",
                fulfillmentCount: null,
                fulfillmentCountPositive: null,
                gradeText: "", // No grade for planned courses
                hierarchy: `wishlist_${course.courseId || course.id}`,
                hierarchyParent: item.hierarchy,
                hierarchyLevel: (item.hierarchyLevel || 3) + 1,
                isDetail: true,
                isTitle: false,
                mark: null, // No mark for planned courses
                maxCredits: "0.00",
                maxFulfillmentCount: null,
                maxFulfillmentCountPositive: null,
                minCredits: "0.00",
                minFulfillmentCount: null,
                minFulfillmentCountPositive: null,
                mncp: "0.00",
                scoreCardMask: 322,
                semester: course.semester || "",
                studyPlanMainFocus: null,
                sumOfCredits: String(course.credits || 0) + ".00", // Convert to string format
                fulfillmentTypeId: 0,
                description: course.name || course.courseId || course.id, // Use name as description
                
                // Fields that useCourseSelection expects
                id: course.courseId || course.id, // Primary identifier
                shortName: course.name || course.courseId || course.id, // Display name
                classification: course.classification || course.type || 'Electives', // For categorization
                credits: course.credits || 0, // ECTS credits
                courseNumber: course.courseId || course.id, // Course identifier for API
                courseId: course.courseId || course.id, // Alternative identifier
                
                // Wishlist/assigned flags
                isWishlist: true,
                isAssigned: !!course.isAssigned,
                enrolled: !!course.isAssigned,
                
                // Keep original course data for debugging
                originalCourse: course
              });
            });
          }
        }

        // Recursively traverse nested items
        if (item.items && Array.isArray(item.items)) {
          traverse(item.items);
        }
      });
    }

    // Start traversal from the transcript root
    if (mutableTranscript.items && Array.isArray(mutableTranscript.items)) {
      mutableTranscript.items.forEach(rootItem => {
        if (rootItem.items) {
          traverse(rootItem.items);
        }
      });
    }

    return mutableTranscript;
  }, [buildWishlistMapping]);

  // Merge wishlist courses into the transcript structure  
  const finalTranscript = useMemo(() => {
    return mergeWishlistIntoTranscript(mainProgramTranscript, wishlistCourses);
  }, [mainProgramTranscript, wishlistCourses, mergeWishlistIntoTranscript]);

  // Ensure selectedCourseIds includes all wishlist courses for proper detection
  React.useEffect(() => {
    const wishlistCourseIds = wishlistCourses.map(course => course.courseId || course.id);
    const missingIds = wishlistCourseIds.filter(id => !selectedCourseIds.includes(id));
    
    if (missingIds.length > 0) {
      setSelectedCourseIds(prev => [...prev, ...missingIds]);
    }
  }, [wishlistCourses, selectedCourseIds, setSelectedCourseIds]);

  /**
   * Handler to clear all saved courses from the backend.
   * It confirms the action with the user and then iterates over the current study plan's courses,
   * calling deleteCourse for each saved course. Upon success, it clears the courses from the local study plan state.
   */
  const handleClearCourses = async () => {
    if (
      !window.confirm(
        "Are you sure you want to clear all saved courses? You have to add all courses to your wishlist again."
      )
    ) {
      return;
    }
    // Ensure we have a study plan and a current plan with saved courses.
    if (
      !studyPlan ||
      !studyPlan.currentPlan ||
      !studyPlan.currentPlan.courses ||
      studyPlan.currentPlan.courses.length === 0
    ) {
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
      setStudyPlan((prev) => ({
        ...prev,
        currentPlan: { ...prev.currentPlan, courses: [] },
      }));
      alert("All saved courses have been cleared - refreshing the page now.");
      // Force a full page refresh
      window.location.reload();
    } catch (error) {
      console.error("Error clearing saved courses:", error);
      handleError(error);
    }
  };

  // Auto-fetch scorecard data if not loaded and haven't tried yet
  const handleFetchIfNeeded = useCallback(async () => {
    if (!academicData.isLoaded && !fetchAttempted && authToken) {
      setFetchAttempted(true);
      await scorecardFetching.fetchAll(authToken);
    }
  }, [academicData.isLoaded, fetchAttempted, authToken, scorecardFetching]);

  // Trigger fetch if needed
  if (!academicData.isLoaded && !fetchAttempted && authToken) {
    handleFetchIfNeeded();
  }

  // Check if data is loaded and transcript has valid structure
  const hasValidTranscript = useMemo(() => {
    return finalTranscript && 
           finalTranscript.items && 
           Array.isArray(finalTranscript.items) &&
           finalTranscript.items.length > 0;
  }, [finalTranscript]);


  // If an error occurred, display the error message (same as original)
  if (scorecardError) {
    return <ScorecardErrorMessage />;
  }

  // Display a loading state while unified data is not available or transcript data is not ready
  const isLoading = !academicData.isLoaded || !hasValidTranscript;

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
        scorecardDetails={finalTranscript}
        semesterShortName={currentSemester}
        semesterIndex={currentSemesterIndex}
        authToken={authToken}
        selectedCourseIds={selectedCourseIds}
        setSelectedCourseIds={setSelectedCourseIds}
      />
      {/* Button to clear all saved courses from the backend */}
      <div className="mt-6 text-center">
        <button
          title="Click to remove all saved courses from the backend. Use this when you need to clean up courses that can't be removed through normal actions."
          onClick={handleClearCourses}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 active:bg-red-800 transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 whitespace-nowrap text-xs md:text-sm"
        >
          Clear All Saved Courses
        </button>
      </div>
    </div>
  );
};

export default Transcript;
