/**
 * useUnifiedDataBridge.js
 * 
 * Bridges existing EventListContainer study plan data to the unified academic data system
 * This eliminates duplicate API calls and ensures both systems use the same data store
 * 
 * Instead of re-fetching study plans, this hook:
 * 1. Reads from existing studyPlanAtom (already populated by EventListContainer)
 * 2. Transforms the data to unified academic data format
 * 3. Enriches with course details using existing API patterns
 * 4. Updates unifiedAcademicDataState with enriched data
 */

import { useEffect, useCallback } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { authTokenState } from '../recoil/authAtom';
import { scorecardDataState } from '../recoil/scorecardsAllRawAtom';
import { studyPlanAtom } from '../recoil/studyPlanAtom';
import { unifiedAcademicDataState, initializedProgramsState } from '../recoil/unifiedAcademicDataAtom';
import { academicDataInitializationSelector } from '../recoil/unifiedAcademicDataSelectors';
import { currentEnrollmentsState } from '../recoil/currentEnrollmentsAtom';
import { fetchCurrentEnrollments } from '../recoil/ApiCurrentEnrollments';
import { getLightCourseDetails } from '../helpers/api';
import { useCurrentSemester, removeSpacesFromSemesterName, isSemesterInPast } from './studyOverviewHelpers';
import { createSemesterMap } from './createSemesterMap';
import { cisIdListSelector } from '../recoil/cisIdListSelector';

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

  return typeTo === "HS" && typeCurrent === "FS";
};

// Helper function to flatten semester courses
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

// Process raw scorecard data (same as StudyOverview)
const processRawScorecard = (rawScorecard) => {
  const semesterMap = {};
  let totalCreditsRequired = 0;
  let totalCreditsCompleted = 0;
  
  const extractCourses = (items) => {
    const courses = [];
    
    items.forEach(item => {
      if (item.isDetail && !item.isTitle) {
        const courseType = item.hierarchyParent && item.hierarchyParent.includes("00100")
          ? "core"
          : item.hierarchyParent && item.hierarchyParent.includes("00101")
          ? "contextual"
          : "elective";
        
        const course = {
          name: item.description || item.shortName,
          credits: parseFloat(item.sumOfCredits || 0),
          type: courseType,
          grade: item.mark ? parseFloat(item.mark) : null,
          id: item.id,
          semester: item.semester || "Unassigned",
          big_type: courseType
        };
        
        courses.push(course);
        totalCreditsRequired += course.credits;
        if (course.grade) {
          totalCreditsCompleted += course.credits;
        }
      } else if (item.items && item.items.length > 0) {
        courses.push(...extractCourses(item.items));
      }
    });
    
    return courses;
  };
  
  const allCourses = extractCourses(rawScorecard.items || []);
  
  allCourses.forEach(course => {
    const semester = course.semester || "Unassigned";
    if (!semesterMap[semester]) {
      semesterMap[semester] = [];
    }
    semesterMap[semester].push(course);
  });
  
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

// Helper function to detect if current data needs upgrading
const needsDataUpgrade = (academicData) => {
  const programs = academicData?.programs || {};
  const firstProgram = Object.keys(programs)[0];
  if (!firstProgram) return false;
  
  const studyPlan = programs[firstProgram]?.studyPlan?.semesterMap || {};
  const semesters = Object.keys(studyPlan);
  const allCourses = Object.values(studyPlan).flat();
  
  // Quality indicators
  const hasMultipleSemesters = semesters.length >= 3;
  const hasEnrichedNames = allCourses.some(c => c.name !== c.id);
  const hasVariableCredits = allCourses.some(c => c.credits !== 4);
  const hasClassifications = allCourses.some(c => c.big_type !== 'elective');
  
  // Return true if data quality is poor (likely from Transcript-first initialization)
  const qualityScore = [hasMultipleSemesters, hasEnrichedNames, hasVariableCredits, hasClassifications].filter(Boolean).length;
  return qualityScore < 3; // Less than 3/4 quality indicators = needs upgrade
};

export const useUnifiedDataBridge = (componentName = 'Unknown', handleError) => {
  const authToken = useRecoilValue(authTokenState);
  const scorecardData = useRecoilValue(scorecardDataState);
  const studyPlan = useRecoilValue(studyPlanAtom); // Use existing study plan data!
  const currentEnrollments = useRecoilValue(currentEnrollmentsState);
  const initStatus = useRecoilValue(academicDataInitializationSelector);
  const academicData = useRecoilValue(unifiedAcademicDataState);
  const currentSemester = useCurrentSemester();
  const cisIdList = useRecoilValue(cisIdListSelector);
  
  const setUnifiedAcademicData = useSetRecoilState(unifiedAcademicDataState);
  const setInitializedPrograms = useSetRecoilState(initializedProgramsState);
  const setCurrentEnrollments = useSetRecoilState(currentEnrollmentsState);

  // Fetch enrollments if needed
  useEffect(() => {
    if (!authToken || currentEnrollments) {
      return;
    }
    const fetchEnrollments = async () => {
      try {
        const enrollmentData = await fetchCurrentEnrollments(authToken);
        setCurrentEnrollments(enrollmentData);
      } catch (error) {
        console.error(`Error fetching enrollments:`, error);
        if (handleError) handleError(error);
      }
    };
    
    fetchEnrollments();
  }, [authToken, currentEnrollments, setCurrentEnrollments, handleError, componentName]);

  // Transform existing study plan data to unified format
  const transformStudyPlanToUnified = useCallback(async (studyPlanData, authToken, cisIdList, currentSemester, needsFullEnrichment = false) => {
    if (!studyPlanData?.allPlans || !Array.isArray(studyPlanData.allPlans)) {
      return {};
    }

    const semesterMap = {};
    const cisIdToSemesterNameMap = createSemesterMap(cisIdList, studyPlanData.allPlans);
    const cleanedCurrentSemester = removeSpacesFromSemesterName(currentSemester);
    
    // Initialize all available semesters from cisIdList (even empty ones)
    Object.values(cisIdToSemesterNameMap).forEach(semesterLabel => {
      const normalizedSemesterLabel = removeSpacesFromSemesterName(semesterLabel);
      
      if (normalizedSemesterLabel !== "Unassigned" && 
          !isSemesterInPast(normalizedSemesterLabel, cleanedCurrentSemester)) {
        semesterMap[normalizedSemesterLabel] = [];
      }
    });
    
    // Add courses to semesters that have them
    for (const semesterItem of studyPlanData.allPlans) {
      const semesterCisId = semesterItem.id;
      const courseIds = semesterItem.courses;
      const rawSemesterLabel = cisIdToSemesterNameMap[semesterCisId] || "Unassigned";
      // Normalize semester name by removing spaces (e.g., "HS 23" → "HS23")
      const semesterLabel = removeSpacesFromSemesterName(rawSemesterLabel);
      
      if (!Array.isArray(courseIds) || semesterLabel === "Unassigned") continue;
      if (isSemesterInPast(semesterLabel, cleanedCurrentSemester)) continue;
      
      // Filter to only include course number format
      const filteredCourseIds = courseIds.filter(courseId => {
        if (typeof courseId === 'string' && courseId.includes(',')) {
          const parts = courseId.split(',');
          return parts.length >= 2 && parts.every(part => part.trim() !== '');
        }
        return false;
      });

      // 🔍 DEBUG: Course filtering in useUnifiedDataBridge
      console.log("🌉 useUnifiedDataBridge Course Filtering:", {
        semesterLabel,
        semesterCisId,
        totalCourseIds: courseIds?.length || 0,
        filteredCourseIds: filteredCourseIds.length,
        allCourseIds: courseIds,
        filteredIds: filteredCourseIds,
        rejectedIds: courseIds?.filter(id => !filteredCourseIds.includes(id)) || []
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
        semesterMap[semesterLabel] = [...(semesterMap[semesterLabel] || []), ...basicCourses];
      }
    }
    
    // Skip enrichment for simple mode (Transcript first scenario)
    if (!needsFullEnrichment) {
      return semesterMap;
    }
    
    // Collect semester IDs that need enrichment
    const semesterIdsToFetch = new Set();
    const referenceMapping = new Map();
    
    for (const semesterItem of studyPlanData.allPlans) {
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
    
    // Progressively enrich courses as API calls complete
    const courseDetailsCache = {};
    
    const enrichmentPromises = Array.from(semesterIdsToFetch).map(async (semesterId) => {
      try {
        const courseDetails = await getLightCourseDetails(semesterId, authToken);
        const enrichedData = flattenSemesterCourses(courseDetails || []);
        courseDetailsCache[semesterId] = enrichedData;
        
        return { semesterId, data: enrichedData };
      } catch (error) {
        courseDetailsCache[semesterId] = {};
        return { semesterId, data: {} };
      }
    });
    
    // Wait for all enrichment to complete
    await Promise.all(enrichmentPromises);
    
    // Copy reference data to placeholder semesters
    for (const [placeholderSemesterId, referenceSemesterId] of referenceMapping) {
      if (courseDetailsCache[referenceSemesterId]) {
        courseDetailsCache[placeholderSemesterId] = { ...courseDetailsCache[referenceSemesterId] };
      }
    }
    
    // Update courses with enriched data
    const enrichedSemesterMap = { ...semesterMap };
    
    for (const semesterItem of studyPlanData.allPlans) {
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
        
        return course;
      });
    }
    
    return enrichedSemesterMap;
  }, [componentName]);

  // 🔍 DEBUG: Reactivity tracking
  useEffect(() => {
    console.log("🔄 useUnifiedDataBridge Reactivity Trigger:", {
      componentName,
      studyPlanChanged: JSON.stringify(studyPlan),
      initStatusChanged: initStatus,
      academicDataChanged: !!academicData,
      timestamp: new Date().toISOString()
    });
  }, [studyPlan, initStatus, academicData, componentName]);

  // Main effect - Bridge existing study plan data to unified format
  useEffect(() => {
    // Check if we need to upgrade existing data (Transcript opening after basic initialization)
    const needsUpgrade = initStatus.isInitialized && needsDataUpgrade(academicData);
    
    // Skip if already initialized with good data or prerequisites not met
    if (!authToken || !scorecardData?.isLoaded || studyPlan?.isLoading) {
      return;
    }
    
    // Skip if already initialized and doesn't need upgrade
    if (initStatus.isInitialized && !needsUpgrade) {
      return;
    }
    
    // Only bridge if we have study plan data
    if (!studyPlan?.allPlans?.length) {
      return;
    }
    
    const bridgeData = async () => {
      try {
        // Step 1: Process scorecard data
        const programs = {};
        const programNames = Object.keys(scorecardData.rawScorecards || {});
        
        programNames.forEach(programName => {
          const rawScorecard = scorecardData.rawScorecards[programName];
          const { semesterMap, progress } = processRawScorecard(rawScorecard);
          
          programs[programName] = {
            transcript: {
              rawScorecard: rawScorecard,
              processedTranscript: semesterMap,
              mergedTranscript: null,
              lastFetched: new Date().toISOString()
            },
            studyPlan: {
              semesterMap: {},
              progress: progress,
              lastUpdated: new Date().toISOString()
            },
            metadata: {
              programId: programName,
              programDescription: programName,
              isMainStudy: true,
              studyRegulationId: "unknown",
              attempt: 1
            }
          };
        });
        
        // Step 2: Transform existing study plan data (no re-fetching!)
        const firstProgram = programNames[0];
        if (firstProgram && programs[firstProgram]) {
          // Determine if we need full enrichment based on component type or upgrade need
          const needsFullEnrichment = componentName === 'StudyOverview' || needsUpgrade;
          
          // 🔍 DEBUG: Study plan transformation
          console.log("🔄 useUnifiedDataBridge Transform:", {
            componentName,
            needsUpgrade,
            needsFullEnrichment,
            studyPlanAllPlansCount: studyPlan?.allPlans?.length || 0,
            studyPlanCurrentPlan: studyPlan?.currentPlan,
            studyPlanData: studyPlan
          });
          
          const enrichedSemesterMap = await transformStudyPlanToUnified(
            studyPlan,
            authToken,
            cisIdList,
            currentSemester,
            needsFullEnrichment
          );
          programs[firstProgram].studyPlan.semesterMap = enrichedSemesterMap;
          
          // 🔍 DEBUG: Transformation result
          console.log("✅ useUnifiedDataBridge Transform Result:", {
            componentName,
            firstProgram,
            enrichedSemesterMapKeys: Object.keys(enrichedSemesterMap),
            enrichedSemesterMapData: enrichedSemesterMap
          });
        }
        
        // Step 3: Update unified academic data
        setUnifiedAcademicData(prev => ({
          ...prev,
          programs,
          currentProgram: programNames[0] || null,
          initialization: {
            ...prev.initialization,
            isInitialized: true,
            lastInitialized: new Date().toISOString()
          }
        }));

        setInitializedPrograms(new Set(programNames));
        
      } catch (error) {
        console.error(`Failed to bridge unified academic data:`, error);
        if (handleError) handleError(error);
      }
    };

    bridgeData();
  }, [authToken, scorecardData?.isLoaded, studyPlan, initStatus.isInitialized, academicData, setUnifiedAcademicData, setInitializedPrograms, handleError, componentName, currentSemester, cisIdList, transformStudyPlanToUnified]);

  return {
    isInitialized: initStatus.isInitialized,
    isLoading: !initStatus.isInitialized,
    hasEnrollments: !!currentEnrollments
  };
};