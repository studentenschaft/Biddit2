import { useRecoilState } from "recoil";
import { useCallback } from "react";
import {
  unifiedAcademicDataState,
  initializedProgramsState,
} from "../recoil/unifiedAcademicDataAtom";

/**
 * Custom hook for managing unified academic data
 * This replaces fragmented scorecard management with a single, comprehensive system
 * Handles transcript data, study plans, progress tracking, and wishlist integration
 */
export function useUnifiedAcademicData() {
  const [academicData, setAcademicData] = useRecoilState(unifiedAcademicDataState);
  const [initializedPrograms, setInitializedPrograms] = useRecoilState(initializedProgramsState);

  /**
   * Initialize a program with empty data structure
   * @param {string} programName - Name of the academic program
   * @param {Object} metadata - Program metadata (programId, isMainStudy, etc.)
   */
  const initializeProgram = (programName, metadata = {}) => {
    if (initializedPrograms.has(programName) || academicData.programs[programName]) {
      console.log(`📋 Program ${programName} already initialized`);
      return;
    }

    console.log(`🚀 Initializing program ${programName}`);
    setAcademicData((prev) => ({
      ...prev,
      programs: {
        ...prev.programs,
        [programName]: {
          transcript: {
            rawScorecard: null,
            processedTranscript: null,
            mergedTranscript: null,
            lastFetched: null
          },
          studyPlan: {
            semesterMap: {},
            progress: {
              totalCreditsRequired: 0,
              totalCreditsCompleted: 0,
              totalCreditsPlanned: 0,
              completionPercentage: 0,
              estimatedCompletion: null
            },
            lastUpdated: null
          },
          metadata: {
            programId: metadata.programId || null,
            programDescription: programName,
            isMainStudy: metadata.isMainStudy || false,
            studyRegulationId: metadata.studyRegulationId || null,
            attempt: metadata.attempt || 1,
            ...metadata
          }
        }
      },
      currentProgram: prev.currentProgram || (metadata.isMainStudy ? programName : prev.currentProgram)
    }));

    setInitializedPrograms((prev) => new Set([...prev, programName]));
  };

  /**
   * Update raw scorecard data for a program
   * @param {string} programName - Name of the program
   * @param {Object} rawScorecard - Raw scorecard data from API
   */
  const updateRawScorecard = (programName, rawScorecard) => {
    console.log(`🔄 Updating raw scorecard for ${programName}`);
    
    if (!academicData.programs[programName]) {
      initializeProgram(programName);
    }

    setAcademicData((prev) => ({
      ...prev,
      programs: {
        ...prev.programs,
        [programName]: {
          ...prev.programs[programName],
          transcript: {
            ...prev.programs[programName].transcript,
            rawScorecard,
            lastFetched: new Date().toISOString()
          }
        }
      }
    }));
  };

  /**
   * Update processed transcript data for a program
   * @param {string} programName - Name of the program
   * @param {Object} processedTranscript - Processed transcript data
   */
  const updateProcessedTranscript = (programName, processedTranscript) => {
    console.log(`🔄 Updating processed transcript for ${programName}`);
    
    setAcademicData((prev) => ({
      ...prev,
      programs: {
        ...prev.programs,
        [programName]: {
          ...prev.programs[programName],
          transcript: {
            ...prev.programs[programName].transcript,
            processedTranscript
          }
        }
      }
    }));
  };

  /**
   * Update merged transcript data (includes wishlist courses)
   * @param {string} programName - Name of the program
   * @param {Object} mergedTranscript - Merged transcript with wishlist courses
   */
  const updateMergedTranscript = (programName, mergedTranscript) => {
    console.log(`🔄 Updating merged transcript for ${programName}`);
    
    setAcademicData((prev) => ({
      ...prev,
      programs: {
        ...prev.programs,
        [programName]: {
          ...prev.programs[programName],
          transcript: {
            ...prev.programs[programName].transcript,
            mergedTranscript
          }
        }
      }
    }));
  };

  /**
   * Update semester data in study plan
   * @param {string} programName - Name of the program
   * @param {string} semesterKey - Semester identifier (e.g., "HS24")
   * @param {Object} semesterData - Semester course data
   */
  const updateSemesterData = (programName, semesterKey, semesterData) => {
    console.log(`🔄 Updating semester ${semesterKey} for ${programName}`);
    
    if (!academicData.programs[programName]) {
      initializeProgram(programName);
    }

    setAcademicData((prev) => ({
      ...prev,
      programs: {
        ...prev.programs,
        [programName]: {
          ...prev.programs[programName],
          studyPlan: {
            ...prev.programs[programName].studyPlan,
            semesterMap: {
              ...prev.programs[programName].studyPlan.semesterMap,
              [semesterKey]: {
                completed: semesterData.completed || [],
                planned: semesterData.planned || [],
                enrolled: semesterData.enrolled || [],
                credits: semesterData.credits || { completed: 0, planned: 0, total: 0 },
                ...semesterData
              }
            },
            lastUpdated: new Date().toISOString()
          }
        }
      }
    }));
  };

  /**
   * Update academic progress for a program
   * @param {string} programName - Name of the program
   * @param {Object} progress - Progress data
   */
  const updateAcademicProgress = useCallback((programName, progress) => {
    console.log(`🔄 Updating academic progress for ${programName}`);
    
    setAcademicData((prev) => ({
      ...prev,
      programs: {
        ...prev.programs,
        [programName]: {
          ...prev.programs[programName],
          studyPlan: {
            ...prev.programs[programName].studyPlan,
            progress: {
              ...prev.programs[programName].studyPlan.progress,
              ...progress
            }
          }
        }
      }
    }));
  }, [setAcademicData]);

  /**
   * Set the current program
   * @param {string} programName - Name of the program to set as current
   */
  const setCurrentProgram = useCallback((programName) => {
    console.log(`🔄 Setting current program to ${programName}`);
    
    setAcademicData((prev) => ({
      ...prev,
      currentProgram: programName
    }));
  }, [setAcademicData]);

  /**
   * Update initialization status
   * @param {Object} initStatus - Initialization status object
   */
  const updateInitializationStatus = useCallback((initStatus) => {
    setAcademicData((prev) => ({
      ...prev,
      initialization: {
        ...prev.initialization,
        ...initStatus
      }
    }));
  }, [setAcademicData]);

  /**
   * Get program data
   * @param {string} programName - Name of the program
   * @returns {Object} Program data or empty structure
   */
  const getProgramData = (programName) => {
    return academicData.programs[programName] || {
      transcript: {
        rawScorecard: null,
        processedTranscript: null,
        mergedTranscript: null,
        lastFetched: null
      },
      studyPlan: {
        semesterMap: {},
        progress: {
          totalCreditsRequired: 0,
          totalCreditsCompleted: 0,
          totalCreditsPlanned: 0,
          completionPercentage: 0,
          estimatedCompletion: null
        },
        lastUpdated: null
      },
      metadata: {}
    };
  };

  /**
   * Get semester data for a program
   * @param {string} programName - Name of the program
   * @param {string} semesterKey - Semester identifier
   * @returns {Object} Semester data or empty structure
   */
  const getSemesterData = (programName, semesterKey) => {
    const programData = getProgramData(programName);
    return programData.studyPlan.semesterMap[semesterKey] || {
      completed: [],
      planned: [],
      enrolled: [],
      credits: { completed: 0, planned: 0, total: 0 }
    };
  };

  /**
   * Check if data needs refresh based on timestamp
   * @param {string} programName - Name of the program
   * @param {number} maxAgeMinutes - Maximum age in minutes before refresh needed
   * @returns {boolean} True if data needs refresh
   */
  const needsRefresh = (programName, maxAgeMinutes = 30) => {
    const programData = getProgramData(programName);
    const lastFetched = programData.transcript.lastFetched;
    
    if (!lastFetched) return true;

    const lastFetchedDate = new Date(lastFetched);
    const now = new Date();
    const ageMinutes = (now - lastFetchedDate) / (1000 * 60);

    return ageMinutes > maxAgeMinutes;
  };

  /**
   * Process raw scorecard into structured format
   * This function transforms the university API format into our internal structure
   * @param {Object} rawScorecard - Raw scorecard from API
   * @returns {Object} Processed semester map
   */
  const processRawScorecard = (rawScorecard) => {
    if (!rawScorecard?.items) return {};

    const semesterMap = {};
    
    // Recursively extract courses from scorecard structure
    const extractCourses = (items, semester = "Unassigned") => {
      const courses = [];
      
      items.forEach(item => {
        if (item.isDetail && !item.isTitle) {
          // This is a course
          courses.push({
            name: item.description || item.shortName,
            credits: parseFloat(item.sumOfCredits || 0),
            type: item.category || "core",
            grade: item.mark ? parseFloat(item.mark) : null,
            id: item.id,
            semester: item.semester || semester,
            courseId: item.courseId,
            big_type: item.big_type || "core"
          });
        } else if (item.items && item.items.length > 0) {
          // This is a category, recursively process
          courses.push(...extractCourses(item.items, semester));
        }
      });
      
      return courses;
    };

    const allCourses = extractCourses(rawScorecard.items);
    
    // Group courses by semester
    allCourses.forEach(course => {
      const semesterKey = course.semester || "Unassigned";
      if (!semesterMap[semesterKey]) {
        semesterMap[semesterKey] = {
          completed: [],
          planned: [],
          enrolled: [],
          credits: { completed: 0, planned: 0, total: 0 }
        };
      }
      
      // Add to completed if it has a grade, otherwise planned
      if (course.grade !== null && course.grade !== undefined) {
        semesterMap[semesterKey].completed.push(course);
        semesterMap[semesterKey].credits.completed += course.credits;
      } else {
        semesterMap[semesterKey].planned.push(course);
        semesterMap[semesterKey].credits.planned += course.credits;
      }
      
      semesterMap[semesterKey].credits.total = 
        semesterMap[semesterKey].credits.completed + 
        semesterMap[semesterKey].credits.planned;
    });

    return semesterMap;
  };

  return {
    academicData,
    initializedPrograms,
    initializeProgram,
    updateRawScorecard,
    updateProcessedTranscript,
    updateMergedTranscript,
    updateSemesterData,
    updateAcademicProgress,
    setCurrentProgram,
    updateInitializationStatus,
    getProgramData,
    getSemesterData,
    needsRefresh,
    processRawScorecard
  };
}