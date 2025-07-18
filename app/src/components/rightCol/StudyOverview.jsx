/**
 * StudyOverview.jsx
 * 
 * This component uses our unified academic data system with the same UI components
 * as the original StudyOverview. It provides better performance, eliminates duplicate
 * code, and fixes infinite loop issues while maintaining identical functionality.
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { authTokenState } from "../recoil/authAtom";
import { currentEnrollmentsState } from "../recoil/currentEnrollmentsAtom";
import LoadingText from "../common/LoadingText";
import { LockClosed } from "../leftCol/bottomRow/LockClosed";
import { fetchCurrentEnrollments } from "../recoil/ApiCurrentEnrollments";
import { useErrorHandler } from "../errorHandling/useErrorHandler";
import { ScorecardErrorMessage } from "../errorHandling/ScorecardErrorMessage";
import PropTypes from "prop-types";
import { selectedTabAtom } from "../recoil/selectedTabAtom";
import { LoadingSkeletonStudyOverview } from "../rightCol/LoadingSkeletons";
import { allCourseInfoState } from "../recoil/allCourseInfosSelector";

// Import APIs and helpers for auto-initialization
import { getStudyPlan, getLightCourseDetails } from "../helpers/api";
import { cisIdListSelector } from "../recoil/cisIdListSelector";
import { createSemesterMap } from "../helpers/createSemesterMap";
import { useInitializeScoreCards } from "../helpers/useInitializeScorecards";
import { useUnifiedDataBridge } from "../helpers/useUnifiedDataBridge";

// Import our unified data system
import { 
  currentProgramDataSelector,
  academicDataInitializationSelector,
  unifiedStudyPlanSelector
} from "../recoil/unifiedAcademicDataSelectors";
import { unifiedAcademicDataState, initializedProgramsState } from "../recoil/unifiedAcademicDataAtom";
import { scorecardDataState } from "../recoil/scorecardsAllRawAtom";

// Import helper functions from the original StudyOverview
import {
  useCurrentSemester,
  getTypeColor,
  removeSpacesFromSemesterName,
  isSemesterInPast,
  filterCoursesForSemester,
  calculateSemesterCredits,
  sortCoursesByType,
} from "../helpers/studyOverviewHelpers";

// Helper function to check if a semester is in the future
const isSemesterInFuture = (semesterToCheck, currentSemester) => {
  if (!semesterToCheck || !currentSemester) return false;

  const normalizedCheck = removeSpacesFromSemesterName(semesterToCheck);
  const normalizedCurrent = removeSpacesFromSemesterName(currentSemester);

  const [typeTo, yearTo] = [
    normalizedCheck.slice(0, 2),
    normalizedCheck.slice(2),
  ];
  const [typeCurrent, yearCurrent] = [
    normalizedCurrent.slice(0, 2),
    normalizedCurrent.slice(2),
  ];

  const yearDiff = parseInt(yearTo) - parseInt(yearCurrent);

  if (yearDiff > 0) return true;
  if (yearDiff < 0) return false;

  // Same year - check semester type
  if (typeTo === typeCurrent) return false;
  // If we're in the same year, HS is considered "in the future" relative to FS
  return typeTo === "HS" && typeCurrent === "FS";
};

/**
 * StudyOverview that uses unified academic data system
 */
const StudyOverview = () => {
  // Use unified data system instead of old selectors
  const academicData = useRecoilValue(unifiedAcademicDataState);
  const initStatus = useRecoilValue(academicDataInitializationSelector);
  const authToken = useRecoilValue(authTokenState);
  const currentEnrollments = useRecoilValue(currentEnrollmentsState);
  const cisIdList = useRecoilValue(cisIdListSelector);
  const allCourseInfo = useRecoilValue(allCourseInfoState); // For filtering available courses
  const handleError = useErrorHandler();
  const setCurrentEnrollments = useSetRecoilState(currentEnrollmentsState);
  const setUnifiedAcademicData = useSetRecoilState(unifiedAcademicDataState);
  const setInitializedPrograms = useSetRecoilState(initializedProgramsState);
  
  // Local state for selected semesters per program (to avoid GUI shifting)
  const [selectedSemesters, setSelectedSemesters] = useState({});
  const [scorecardError, setScorecardError] = useState(false);
  
  const handleSetSelectedSemester = useCallback(
    (program, semester) => {
      setSelectedSemesters(prev => ({
        ...prev,
        [program]: semester
      }));
    },
    []
  );

  // Initialize scorecard data (needed for unified system)
  useInitializeScoreCards(handleError);
  const scorecardData = useRecoilValue(scorecardDataState);

  // Get current semester for auto-initialization
  const currentSemester = useCurrentSemester();
  
  // Use unified data bridge that leverages EventListContainer's existing study plan data
  const { isInitialized, isLoading: dataLoading } = useUnifiedDataBridge('StudyOverview', handleError);

  // Create a helper function to filter courses based on availability and enrich with course details
  const filterAndEnrichCoursesForAvailability = useCallback((courses, currentSemester) => {
    if (!allCourseInfo || !currentSemester) return courses;
    
    // Build comprehensive course database from all available semesters
    const courseDatabase = new Map(); // courseNumber -> course details
    const availableCourseNumbers = new Set();
    
    // Check all semester indices for available courses and build database
    Object.values(allCourseInfo).forEach(semesterCourses => {
      if (Array.isArray(semesterCourses)) {
        semesterCourses.forEach(course => {
          if (course.courseNumber) {
            availableCourseNumbers.add(course.courseNumber);
            
            // Store course details for enrichment (prefer more complete data)
            if (!courseDatabase.has(course.courseNumber) || 
                (course.shortName && course.shortName !== course.courseNumber)) {
              courseDatabase.set(course.courseNumber, {
                name: course.shortName || course.name || course.courseNumber,
                credits: course.credits ? parseFloat(course.credits) / 100 : 0,
                classification: course.classification || "elective",
                description: course.description || course.shortName || course.name
              });
            }
          }
        });
      }
    });
    
    // Filter and enrich courses
    return courses.filter(course => {
      // Keep transcript courses (already completed, have grades OR passed status)
      if (course.grade && course.grade > 0) {
        return true;
      }
      
      // Keep courses with passed status (gradeText like "p.")
      if (course.gradeText && course.gradeText.toLowerCase().includes('p')) {
        return true;
      }
      
      // Keep Campus Credits and Practice Credits even if grades are null
      if (course.name === "Campus Credits" || course.name === "Practice Credits") {
        return true;
      }
      
      // Keep transcript courses that appear in scorecard even if grades are null
      // These are courses that exist in the official transcript but don't have grades yet
      if (course.type === "area of concentration" || course.type === "contextual" || course.type === "elective") {
        // If it's not a wishlist course (doesn't have the -wishlist suffix), keep it
        if (!course.type?.endsWith('-wishlist')) {
          return true;
        }
      }
      
      // For wishlist courses, only keep if available in current semester
      if (course.type?.endsWith('-wishlist') || !course.grade) {
        return availableCourseNumbers.has(course.courseId) || availableCourseNumbers.has(course.courseNumber);
      }
      
      return true;
    }).map(course => {
      // Enrich course with details from database if available
      const courseNumber = course.courseNumber || course.courseId;
      const enrichmentData = courseDatabase.get(courseNumber);
      
      if (enrichmentData && (course.name === courseNumber || course.name?.startsWith('Course '))) {
        return {
          ...course,
          name: enrichmentData.name,
          credits: enrichmentData.credits || course.credits,
          classification: enrichmentData.classification || course.classification,
          description: enrichmentData.description || course.description
        };
      }
      
      return course;
    });
  }, [allCourseInfo]);

  // Fetch current enrollments if not already loaded (same as original)
  useEffect(() => {
    if (!authToken) return;
    if (currentEnrollments) return;
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

  // Transform unified data to match original StudyOverview format
  const transformedData = useMemo(() => {
    if (!initStatus.isInitialized || !academicData.programs) return {};
    
    const result = {};
    
    // Process all programs, not just the current one
    Object.entries(academicData.programs).forEach(([programKey, programData]) => {
      // Transform completed courses from transcript
      const transcriptData = programData.transcript?.processedTranscript || {};
      
      // Transform study plan (wishlist) courses
      const studyPlanData = programData.studyPlan?.semesterMap || {};
      
      // Merge transcript and study plan data by semester
      const allSemesters = new Set([
        ...Object.keys(transcriptData),
        ...Object.keys(studyPlanData)
      ]);
      
      const semesterMap = {};
      allSemesters.forEach(semester => {
        if (semester === "Unassigned") return; // Skip unassigned
        
        const transcriptCourses = transcriptData[semester] || [];
        const studyPlanCourses = studyPlanData[semester] || [];
        
        // Transform transcript courses to match original format
        const transformedTranscriptCourses = transcriptCourses.map(course => ({
          name: course.name,
          credits: course.credits,
          type: course.type,
          grade: course.grade,
          courseId: course.id,
          courseNumber: course.courseNumber || course.id,
          big_type: course.big_type
        }));
        
        // Transform study plan courses to match original format (add -wishlist suffix)
        const transformedStudyPlanCourses = studyPlanCourses.map(course => ({
          name: course.name,
          credits: course.credits,
          type: `${course.big_type}-wishlist`,
          grade: null,
          courseId: course.id,
          courseNumber: course.courseNumber || course.id,
          big_type: course.big_type
        }));
        
        // Combine transcript and study plan courses
        const allCoursesForSemester = [
          ...transformedTranscriptCourses,
          ...transformedStudyPlanCourses
        ];
        
        // Filter courses to only show those available in current semester and enrich with course details
        const filteredCourses = filterAndEnrichCoursesForAvailability(allCoursesForSemester, semester);
        
        semesterMap[semester] = filteredCourses;
      });
      
      // Use program description as key (same as original)
      const programName = programData.metadata?.programDescription || programKey;
      result[programName] = semesterMap;
    });
    
    return result;
  }, [academicData.programs, initStatus.isInitialized, filterAndEnrichCoursesForAvailability]);

  // Add current enrollments to the data (same logic as original)
  const finalDisplayDataWithEnrolled = useMemo(() => {
    if (!transformedData) return transformedData;
    
    // Check if currentEnrollments has enrollmentInfos array
    if (!currentEnrollments?.enrollmentInfos || !Array.isArray(currentEnrollments.enrollmentInfos)) {
      return transformedData;
    }
    
    // Look for enrolled courses in the enrollmentInfos structure
    const allEnrollments = currentEnrollments.enrollmentInfos.flatMap(enrollment => 
      enrollment.courses || []
    );
    const currentEnrolledCourses = allEnrollments.filter(course => course.enrolled) || [];
    if (currentEnrolledCourses.length === 0) return transformedData;
    
    const updated = JSON.parse(JSON.stringify(transformedData));
    
    // Format enrolled courses (same as original)
    const enrolledCoursesFormatted = currentEnrolledCourses.map((course) => ({
      name: course.shortName || course.eventDescription,
      credits: course.credits / 100,
      type: course.classification || "core",
      courseId: course.id,
      courseNumber: course.courseNumber,
      description: course.eventDescription,
      eventCourseNumber: course.eventCourseNumber,
      languageId: course.languageId,
    }));
    
    // Add enrolled courses to current semester (same logic as original)
    Object.keys(updated).forEach((program) => {
      const semesterKeys = Object.keys(updated[program]);
      const currentSemesterKey = semesterKeys.find(
        (semKey) => removeSpacesFromSemesterName(semKey) === removeSpacesFromSemesterName(currentSemester)
      );
      
      if (currentSemesterKey) {
        const existingCourses = updated[program][currentSemesterKey] || [];
        const existingCourseIds = new Set(existingCourses.map(c => c.courseId));
        
        // Add non-duplicate enrolled courses
        const newEnrolledCourses = enrolledCoursesFormatted.filter(
          course => !existingCourseIds.has(course.courseId)
        );
        
        updated[program][currentSemesterKey] = [
          ...existingCourses,
          ...newEnrolledCourses
        ];
      }
    });
    
    return updated;
  }, [transformedData, currentEnrollments, currentSemester]);

  // Helper functions for auto-initialization (same as SimpleUnifiedDataBridge)
  const processRawScorecard = (rawScorecard) => {
    const semesterMap = {};
    let totalCreditsRequired = 0;
    let totalCreditsCompleted = 0;
    
    const extractCourses = (items) => {
      const courses = [];
      
      // Debug: Log all items being processed
      console.log("🔍 StudyOverview extractCourses - Processing items:", items);
      console.log("🔍 StudyOverview extractCourses - Item count:", items?.length || 0);
      
      items.forEach(item => {
        if (item.isDetail && !item.isTitle) {
          const courseType = item.hierarchyParent && item.hierarchyParent.includes("00100")
            ? "core"
            : item.hierarchyParent && item.hierarchyParent.includes("00101200")
            ? "area of concentration"
            : item.hierarchyParent && item.hierarchyParent.includes("00101")
            ? "contextual"
            : "elective";
          
          const course = {
            name: item.description || item.shortName || `Course ${item.id}`,
            credits: parseFloat(item.sumOfCredits || 0),
            type: courseType,
            grade: item.mark ? parseFloat(item.mark) : null,
            gradeText: item.gradeText || null, // Preserve gradeText for "passed" courses
            id: item.id,
            semester: item.semester ? removeSpacesFromSemesterName(item.semester) : "Unassigned",
            big_type: courseType
          };
          
          courses.push(course);
          totalCreditsRequired += course.credits;
          // Count as completed if it has a numeric grade OR if it's marked as passed
          if (course.grade || (course.gradeText && course.gradeText.toLowerCase().includes('p'))) {
            totalCreditsCompleted += course.credits;
          }
          
          // Debug: Log processed courses
          if (course.name && course.name.includes("Area of Concentration")) {
            console.log("🔍 Processing Area of Concentration course:", {
              name: course.name,
              semester: course.semester,
              type: course.type,
              grade: course.grade,
              gradeText: course.gradeText,
              credits: course.credits
            });
          }
        } else if (item.items && item.items.length > 0) {
          courses.push(...extractCourses(item.items));
        }
      });
      
      return courses;
    };
    
    // Debug: Log raw scorecard being processed
    console.log("🔍 StudyOverview processRawScorecard - rawScorecard:", rawScorecard);
    console.log("🔍 StudyOverview processRawScorecard - rawScorecard.items:", rawScorecard.items);
    
    const allCourses = extractCourses(rawScorecard.items || []);
    
    allCourses.forEach(course => {
      const semester = course.semester || "Unassigned";
      if (!semesterMap[semester]) {
        semesterMap[semester] = [];
      }
      semesterMap[semester].push(course);
      
      // Debug: Log semester assignment
      if (course.name && course.name.includes("Area of Concentration")) {
        console.log("🔍 Adding Area of Concentration to semester map:", {
          semester: semester,
          course: course
        });
      }
    });
    
    // Debug: Log final semester map
    console.log("🔍 Final semester map:", semesterMap);
    
    const progress = {
      totalCreditsRequired,
      totalCreditsCompleted,
      totalCreditsPlanned: 0,
      completionPercentage: totalCreditsRequired > 0 ? 
        Math.round((totalCreditsCompleted / totalCreditsRequired) * 100) : 0,
      estimatedCompletion: null
    };
    
    return { semesterMap, progress };
  };

  const processStudyPlansData = async (studyPlansData, authToken, cisIdList, currentSemester, setUnifiedAcademicData, firstProgram) => {
    const semesterMap = {};
    const cisIdToSemesterNameMap = createSemesterMap(cisIdList, studyPlansData);
    const cleanedCurrentSemester = removeSpacesFromSemesterName(currentSemester);
    
    
    // STEP 1: Initialize all available semesters from cisIdList (even empty ones)
    Object.values(cisIdToSemesterNameMap).forEach(semesterLabel => {
      if (semesterLabel !== "Unassigned" && 
          !isSemesterInPast(removeSpacesFromSemesterName(semesterLabel), cleanedCurrentSemester)) {
        semesterMap[semesterLabel] = []; // Initialize empty semester
      }
    });
    
    // STEP 2: Add courses to semesters that have them
    for (const semesterItem of studyPlansData) {
      const semesterCisId = semesterItem.id;
      const courseIds = semesterItem.courses;
      const semesterLabel = cisIdToSemesterNameMap[semesterCisId] || "Unassigned";
      
      if (!Array.isArray(courseIds) || semesterLabel === "Unassigned") continue;
      if (isSemesterInPast(removeSpacesFromSemesterName(semesterLabel), cleanedCurrentSemester)) continue;
      
      // Filter to only include course number format
      const filteredCourseIds = courseIds.filter(courseId => {
        if (typeof courseId === 'string' && courseId.includes(',')) {
          const parts = courseId.split(',');
          return parts.length >= 2 && parts.every(part => part.trim() !== '');
        }
        return false;
      });
      
      if (filteredCourseIds.length === 0) continue;
      
      // Create basic courses immediately (no enrichment yet)
      const basicCourses = filteredCourseIds.map(courseId => ({
        name: `Course ${courseId}`, // Temporary name - will be enriched
        credits: 4, // Default to 4 ECTS - will be enriched with actual values
        type: "wishlist",
        grade: null,
        id: courseId,
        semester: semesterLabel,
        big_type: "elective", // Will be enriched
        courseNumber: courseId,
        classification: "unknown", // Will be enriched
        eventCourseNumber: courseId,
        isEnriched: false // Flag to track enrichment status
      }));
      
      if (basicCourses.length > 0) {
        // Add courses to existing semester (initialized above)
        semesterMap[semesterLabel] = [...(semesterMap[semesterLabel] || []), ...basicCourses];
      }
    }
    
    
    // STEP 2: Update UI immediately with basic course structure AND mark as initialized
    setUnifiedAcademicData(prev => ({
      ...prev,
      programs: {
        ...prev.programs,
        [firstProgram]: {
          ...prev.programs[firstProgram],
          studyPlan: {
            ...(prev.programs[firstProgram]?.studyPlan || {}),
            semesterMap: semesterMap,
            isEnriching: true // Flag to show loading indicators
          }
        }
      },
      initialization: {
        ...prev.initialization,
        isInitialized: true, // Set to true immediately so UI shows basic courses
        isEnriching: true, // Track enrichment separately
        lastInitialized: new Date().toISOString()
      }
    }));
    
    // STEP 3: Start background enrichment
    
    // Collect semester IDs that need enrichment
    const semesterIdsToFetch = new Set();
    const referenceMapping = new Map();
    
    for (const semesterItem of studyPlansData) {
      const semesterCisId = semesterItem.id;
      const courseIds = semesterItem.courses;
      const semesterLabel = cisIdToSemesterNameMap[semesterCisId] || "Unassigned";
      
      if (!Array.isArray(courseIds) || semesterLabel === "Unassigned") continue;
      if (isSemesterInPast(removeSpacesFromSemesterName(semesterLabel), cleanedCurrentSemester)) continue;
      
      // Handle placeholder semesters
      if (semesterCisId.includes("Placeholder") || 
          isSemesterInFuture(semesterLabel, cleanedCurrentSemester)) {
        
        const semesterMatch = semesterCisId.includes("Placeholder") 
          ? semesterCisId.match(/(HS|FS)\s*(\d{2})\s*-\s*Placeholder/)
          : semesterLabel.match(/(HS|FS)(\d{2})/);
        if (semesterMatch) {
          const semesterType = semesterMatch[1];
          const semesterYear = parseInt(semesterMatch[2], 10);
          
          let referenceSemesterId = null;
          let highestPastYear = 0;
          
          for (const [cisId, semName] of Object.entries(cisIdToSemesterNameMap)) {
            if (cisId.includes("Placeholder")) continue;
            
            const realSemMatch = semName.match(/(HS|FS)(\d{2})/);
            if (realSemMatch && realSemMatch[1] === semesterType) {
              const realYear = parseInt(realSemMatch[2], 10);
              if (realYear < semesterYear && realYear > highestPastYear) {
                highestPastYear = realYear;
                referenceSemesterId = cisId;
              }
            }
          }
          
          if (referenceSemesterId) {
            semesterIdsToFetch.add(referenceSemesterId);
            referenceMapping.set(semesterCisId, referenceSemesterId);
          }
        }
      } else {
        semesterIdsToFetch.add(semesterCisId);
      }
    }
    
    // STEP 4: Progressively enrich courses as API calls complete
    const courseDetailsCache = {};
    let completedFetches = 0;
    const totalFetches = semesterIdsToFetch.size;
    
    const enrichmentPromises = Array.from(semesterIdsToFetch).map(async (semesterId) => {
      try {
        const courseDetails = await getLightCourseDetails(semesterId, authToken);
        const enrichedData = flattenSemesterCourses(courseDetails || []);
        courseDetailsCache[semesterId] = enrichedData;
        
        completedFetches++;
        
        // Update UI progressively as each semester completes
        return { semesterId, data: enrichedData };
      } catch (error) {
        console.error(`Failed to fetch course details for ${semesterId}: ${error.message}`);
        courseDetailsCache[semesterId] = {};
        completedFetches++;
        return { semesterId, data: {} };
      }
    });
    
    // Process enrichment results as they come in with proper state updates
    const updateEnrichmentProgress = () => {
      // Copy reference data to placeholder semesters
      for (const [placeholderSemesterId, referenceSemesterId] of referenceMapping) {
        if (courseDetailsCache[referenceSemesterId]) {
          courseDetailsCache[placeholderSemesterId] = { ...courseDetailsCache[referenceSemesterId] };
        }
      }
      
      // Update courses with enriched data
      const enrichedSemesterMap = { ...semesterMap };
      
      for (const semesterItem of studyPlansData) {
        const semesterCisId = semesterItem.id;
        const courseIds = semesterItem.courses;
        const semesterLabel = cisIdToSemesterNameMap[semesterCisId] || "Unassigned";
        
        if (!Array.isArray(courseIds) || semesterLabel === "Unassigned") continue;
        if (isSemesterInPast(removeSpacesFromSemesterName(semesterLabel), cleanedCurrentSemester)) continue;
        if (!enrichedSemesterMap[semesterLabel]) continue;
        
        const courseDict = courseDetailsCache[semesterCisId] || {};
        if (Object.keys(courseDict).length === 0) continue; // Skip if no enrichment data
        
        // Enrich existing courses
        enrichedSemesterMap[semesterLabel] = enrichedSemesterMap[semesterLabel].map(course => {
          if (course.isEnriched) return course; // Already enriched
          
          let courseDetails = courseDict[course.id];
          
          if (!courseDetails) {
            for (const courseData of Object.values(courseDict)) {
              if (courseData.eventCourseNumber === course.id || courseData.courseNumber === course.id) {
                courseDetails = courseData;
                break;
              }
            }
          }
          
          if (courseDetails) {
            return {
              ...course,
              name: courseDetails.shortName || courseDetails.description || course.name,
              credits: courseDetails.credits ? parseFloat(courseDetails.credits) / 100 : 0,
              big_type: courseDetails.classification || "elective",
              classification: courseDetails.classification || "unknown",
              courseNumber: courseDetails.courseNumber || course.id,
              eventCourseNumber: courseDetails.eventCourseNumber || course.id,
              isEnriched: true
            };
          }
          
          return course; // Return unchanged if no enrichment data
        });
      }
      
      // Update UI with progressive enrichment
      setUnifiedAcademicData(prev => ({
        ...prev,
        programs: {
          ...prev.programs,
          [firstProgram]: {
            ...prev.programs[firstProgram],
            studyPlan: {
              ...(prev.programs[firstProgram]?.studyPlan || {}),
              semesterMap: enrichedSemesterMap,
              isEnriching: completedFetches < totalFetches,
              enrichmentProgress: completedFetches / totalFetches
            }
          }
        }
      }));
    };

    // Attach progress updates to each promise
    enrichmentPromises.forEach(promise => {
      promise.then(() => {
        // Use setTimeout to ensure state update happens on next tick
        setTimeout(updateEnrichmentProgress, 0);
      });
    });
    
    // Wait for all enrichment to complete
    await Promise.all(enrichmentPromises);
    
    
    // STEP 5: Mark enrichment as complete
    setUnifiedAcademicData(prev => ({
      ...prev,
      programs: {
        ...prev.programs,
        [firstProgram]: {
          ...prev.programs[firstProgram],
          studyPlan: {
            ...(prev.programs[firstProgram]?.studyPlan || {}),
            isEnriching: false,
            enrichmentProgress: 1
          }
        }
      },
      initialization: {
        ...prev.initialization,
        isEnriching: false // Mark enrichment as complete
      }
    }));
    
    return semesterMap;
  };

  const flattenSemesterCourses = (semesterCourseData = []) => {
    const courseDict = {};
    
    for (const course of semesterCourseData) {
      courseDict[course.id] = { ...course };
      
      if (Array.isArray(course.courses)) {
        for (const sub of course.courses) {
          courseDict[sub.id] = {
            ...course,
            ...sub,
            credits: course.credits
          };
        }
      }
    }
    
    return courseDict;
  };

  // Main study description logic (same as original)
  const mainStudyDescription = useMemo(() => {
    if (!Array.isArray(currentEnrollments)) return null;
    const mainStudy = currentEnrollments.find(enrollment => enrollment.isMainStudy);
    return mainStudy?.studyProgramDescription || null;
  }, [currentEnrollments]);

  // Sort programs to prioritize main study (same as original)
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

  // Loading states (adapted for unified system)
  const isLoading = !initStatus.isInitialized;
  const hasNoData = initStatus.isInitialized && Object.keys(finalDisplayDataWithEnrolled).length === 0;

  if (scorecardError) {
    return <ScorecardErrorMessage />;
  }

  return (
    <div className="flex flex-col px-8 py-4">
      <h1 className="text-2xl font-bold mb-4">Study Overview</h1>

      {/* Loading state */}
      {isLoading && (
        <div className="mb-6">
          <LoadingText>Loading your saved courses...</LoadingText>
          <LoadingSkeletonStudyOverview />
        </div>
      )}

      {/* Enrichment progress indicator */}
      {!isLoading && initStatus.isEnriching && (
        <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded">
          <div className="flex items-center gap-2">
            <div className="animate-spin h-4 w-4 border-2 border-gray-600 border-t-transparent rounded-full"></div>
            <span className="text-gray-700 text-sm">Enriching course details...</span>
          </div>
        </div>
      )}

      {/* No data message */}
      {hasNoData && (
        <div>No scorecard data found.</div>
      )}

      {/* Render programs using original UI components */}
      {sortedScorecardsEntries.map(([program, semesters], index, array) => {
        // Find the raw scorecard for this program
        const programData = Object.values(academicData.programs || {}).find(
          p => p.metadata?.programDescription === program
        );
        
        return (
          <div key={program}>
            <ProgramSection
              program={program}
              semesters={semesters}
              selectedSemester={selectedSemesters[program] || null}
              setSelectedSemester={(semester) => handleSetSelectedSemester(program, semester)}
              rawScorecard={programData?.transcript?.rawScorecard} // Pass raw scorecard for summary
            />
            {index < array.length - 1 && (
              <div className="my-8 h-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
            )}
          </div>
        );
      })}
    </div>
  );
};

// Import and reuse all original UI components exactly as they are
// (Just copying them here to keep the hybrid component self-contained)

const ProgramSection = ({
  program,
  semesters,
  selectedSemester,
  setSelectedSemester,
  rawScorecard
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
      <div
        className={`col-span-2 md:col-span-1 font-semibold cursor-pointer ${
          selectedSemester === semester ? "text-green-800" : ""
        }`}
      >
        {removeSpacesFromSemesterName(semester)}
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
          <div className="text-center">
            {avgGrade ? avgGrade.toFixed(2) : "N/A"}
          </div>
        )}
      </div>
    </div>
  );
};

const CourseBar = ({ course, setHoveredCourse, maxSemesterCredits }) => {
  const isEnriched = course.isEnriched !== false; // Default to true for existing courses
  
  return (
    <div
      className={`h-full m-0.5 md:m-1 rounded flex items-center justify-center text-white
        ${getTypeColor(course)}
        transition-all duration-200
        hover:shadow-lg hover:scale-y-105
        ${!isEnriched ? 'animate-pulse opacity-70' : ''}`}
      style={{
        width: `${(course.credits / maxSemesterCredits) * 100}%`,
        minWidth: "0.25rem",
      }}
      onMouseEnter={() => setHoveredCourse(course)}
      onMouseLeave={() => setHoveredCourse(null)}
      title={!isEnriched ? 'Loading course details...' : course.name}
    />
  );
};

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
              <div className={`col-span-4 font-semibold truncate ${!isEnriched ? 'text-gray-500' : ''}`}>
                {course.name}
                {!isEnriched && (
                  <span className="ml-2 text-xs text-gray-500 animate-pulse">Loading...</span>
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

const ProgramSummaryRow = ({ program, rawScorecard }) => {
  // Extract credits from raw scorecard or use unified data
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

// PropTypes (same as original)
const courseShape = PropTypes.shape({
  name: PropTypes.string.isRequired,
  credits: PropTypes.number.isRequired,
  type: PropTypes.string.isRequired,
  grade: PropTypes.number,
});

ProgramSection.propTypes = {
  program: PropTypes.string.isRequired,
  semesters: PropTypes.objectOf(PropTypes.arrayOf(courseShape)).isRequired,
  selectedSemester: PropTypes.string,
  setSelectedSemester: PropTypes.func.isRequired,
  rawScorecard: PropTypes.object,
};

export default StudyOverview;