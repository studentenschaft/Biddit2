/**
 * useModernUnifiedDataBridge.js
 * 
 * Modern unified data bridge that uses only the new unifiedCourseDataAtom
 * Replaces the legacy bridge that depended on studyPlanAtom and localSelectedCoursesSemKeyState
 * 
 * This bridge:
 * 1. Reads directly from unifiedCourseDataAtom (populated by EventListContainer)
 * 2. Transforms unified course data to unified academic data format
 * 3. Combines with scorecard data for complete academic overview
 * 4. Provides real-time updates as users select/deselect courses
 * 
 * No dependency on legacy atoms - uses only modern unified data flow
 */

import { useEffect, useCallback, useRef } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { authTokenState } from '../recoil/authAtom';
import { scorecardDataState } from '../recoil/scorecardsAllRawAtom';
import { unifiedAcademicDataState, initializedProgramsState } from '../recoil/unifiedAcademicDataAtom';
import { academicDataInitializationSelector } from '../recoil/unifiedAcademicDataSelectors';
import { currentEnrollmentsState } from '../recoil/currentEnrollmentsAtom';
import { fetchCurrentEnrollments } from '../recoil/ApiCurrentEnrollments';

// Modern unified course data selectors
import { 
  allSemesterCoursesSelector,
  semesterCoursesSelector,
  currentSemesterSelector
} from '../recoil/unifiedCourseDataSelectors';

import { useCurrentSemester, removeSpacesFromSemesterName } from './studyOverviewHelpers';

// Helper function to normalize credits from API format to display format
const normalizeCredits = (credits) => {
  if (!credits) return 4; // Default to 4 ECTS
  if (typeof credits === 'number' && credits > 99) {
    return credits / 100; // Convert 400 -> 4, 200 -> 2, etc.
  }
  return credits;
};

// Process raw scorecard data (same as legacy bridge)
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
          gradeText: item.gradeText || null,
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

export const useModernUnifiedDataBridge = (componentName = 'Unknown', handleError) => {
  const authToken = useRecoilValue(authTokenState);
  const scorecardData = useRecoilValue(scorecardDataState);
  const currentEnrollments = useRecoilValue(currentEnrollmentsState);
  const initStatus = useRecoilValue(academicDataInitializationSelector);
  const academicData = useRecoilValue(unifiedAcademicDataState);
  const currentSemester = useCurrentSemester();
  
  // Modern unified course data selectors
  const allSemesterCourses = useRecoilValue(allSemesterCoursesSelector);
  const unifiedCurrentSemester = useRecoilValue(currentSemesterSelector);
  
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

  // Transform unified course data to academic data format
  const transformUnifiedCourseDataToAcademic = useCallback((allSemesterCourses) => {
    const semesterMap = {};
    
    // Process each semester's selected courses
    Object.entries(allSemesterCourses).forEach(([semesterShortName, semesterData]) => {
      // Get selected courses for this semester using the selector
      const selectedCourses = semesterData.available?.filter(course => {
        const courseNumber = course.courses?.[0]?.courseNumber || course.courseNumber || course.id;
        return courseNumber && (semesterData.selectedIds || []).includes(courseNumber);
      }) || [];
      
      if (selectedCourses.length > 0) {
        // Transform selected courses to unified academic format
        const academicCourses = selectedCourses.map(course => ({
          name: course.shortName || course.name || `Course ${course.id}`,
          credits: normalizeCredits(course.credits),
          type: `${course.classification || 'elective'}-wishlist`,
          grade: null, // Wishlist courses don't have grades
          id: course.id,
          semester: semesterShortName,
          big_type: course.classification || 'elective',
          courseNumber: course.courses?.[0]?.courseNumber || course.courseNumber || course.id,
          classification: course.classification || 'elective',
          eventCourseNumber: course.courses?.[0]?.eventCourseNumber || course.eventCourseNumber || course.id,
          isEnriched: true // Course data comes pre-enriched from unified system
        }));
        
        semesterMap[semesterShortName] = academicCourses;
      }
    });
    
    return semesterMap;
  }, []);

  // Main effect - Bridge unified course data to academic format
  useEffect(() => {
    // Skip if prerequisites not met
    if (!authToken || !scorecardData?.isLoaded) {
      return;
    }
    
    // Skip if already initialized and no course data changes
    if (initStatus.isInitialized && Object.keys(allSemesterCourses).length === 0) {
      return;
    }
    
    const bridgeModernData = async () => {
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
        
        // Step 2: Transform unified course data to academic format
        const firstProgram = programNames[0];
        if (firstProgram && programs[firstProgram]) {
          const transformedSemesterMap = transformUnifiedCourseDataToAcademic(allSemesterCourses);
          programs[firstProgram].studyPlan.semesterMap = transformedSemesterMap;
          
          // Update progress to include planned credits
          let totalCreditsPlanned = 0;
          Object.values(transformedSemesterMap).forEach(courses => {
            courses.forEach(course => {
              totalCreditsPlanned += course.credits || 0;
            });
          });
          
          programs[firstProgram].studyPlan.progress = {
            ...programs[firstProgram].studyPlan.progress,
            totalCreditsPlanned
          };
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
        console.error(`Failed to bridge modern unified academic data:`, error);
        if (handleError) handleError(error);
      }
    };

    bridgeModernData();
  }, [
    authToken, 
    scorecardData?.isLoaded, 
    allSemesterCourses, 
    initStatus.isInitialized,
    setUnifiedAcademicData, 
    setInitializedPrograms, 
    handleError, 
    componentName,
    transformUnifiedCourseDataToAcademic
  ]);

  // Real-time updates effect - Update academic data when unified course selections change
  const lastUpdateRef = useRef(null);
  
  useEffect(() => {
    // Skip if not initialized yet
    if (!initStatus.isInitialized || !academicData.programs) {
      return;
    }
    
    // Create a hash of current unified course selections to detect changes
    const currentHash = JSON.stringify(allSemesterCourses);
    
    // Skip if no actual changes (prevents infinite loops)
    if (lastUpdateRef.current === currentHash) {
      return;
    }
    
    // Update the hash reference
    lastUpdateRef.current = currentHash;
    
    // Update unified academic data with current selections from unified course data
    setUnifiedAcademicData(prev => {
      const programs = { ...prev.programs };
      const firstProgram = Object.keys(programs)[0];
      
      if (firstProgram && programs[firstProgram]) {
        // Transform current unified course selections
        const updatedSemesterMap = transformUnifiedCourseDataToAcademic(allSemesterCourses);
        
        // Preserve existing transcript courses and merge with new selections
        const existingTranscript = programs[firstProgram].transcript?.processedTranscript || {};
        const mergedSemesterMap = { ...updatedSemesterMap };
        
        // For each semester, combine transcript courses with wishlist courses
        Object.keys(existingTranscript).forEach(semester => {
          const transcriptCourses = existingTranscript[semester] || [];
          const wishlistCourses = updatedSemesterMap[semester] || [];
          
          // Only include transcript courses that have grades
          const gradedCourses = transcriptCourses.filter(course => 
            course.grade && course.grade > 0
          );
          
          // Combine graded courses with wishlist courses
          if (gradedCourses.length > 0 || wishlistCourses.length > 0) {
            mergedSemesterMap[semester] = [
              ...gradedCourses,
              ...wishlistCourses
            ];
          }
        });
        
        // Calculate updated progress
        let totalCreditsPlanned = 0;
        Object.values(updatedSemesterMap).forEach(courses => {
          courses.forEach(course => {
            totalCreditsPlanned += course.credits || 0;
          });
        });
        
        programs[firstProgram] = {
          ...programs[firstProgram],
          studyPlan: {
            ...programs[firstProgram].studyPlan,
            semesterMap: mergedSemesterMap,
            progress: {
              ...programs[firstProgram].studyPlan.progress,
              totalCreditsPlanned
            },
            lastUpdated: new Date().toISOString()
          }
        };
      }
      
      return {
        ...prev,
        programs
      };
    });
  }, [
    allSemesterCourses, 
    initStatus.isInitialized, 
    academicData.programs, 
    setUnifiedAcademicData,
    transformUnifiedCourseDataToAcademic,
    componentName
  ]);

  return {
    isInitialized: initStatus.isInitialized,
    isLoading: !initStatus.isInitialized,
    hasEnrollments: !!currentEnrollments
  };
};