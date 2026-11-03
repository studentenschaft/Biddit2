import { log } from '../../../helpers/log';

/**
 * dataAdapter.js
 * 
 * Adapts our unifiedAcademicDataSelector data to the format expected by 
 * the extracted StudyOverview components
 */

// Removed enrichCourseFromUnified function - now leveraging existing EventListContainer enrichment system

/**
 * Converts unified academic data to the format expected by ProgramOverview
 * @param {Object} academicData - Data from unifiedAcademicDataSelector
 * @returns {Object} - Adapted data for ProgramOverview components
 */
export const adaptAcademicDataForStudyOverview = (academicData) => {
  log.debug('🔄 [dataAdapter] CONVERTING ACADEMIC DATA');
  log.debug('Input academicData:', academicData);
  
  if (!academicData.isLoaded || !academicData.programs) {
    log.debug('❌ Early return - data not loaded or no programs:', {
      isLoaded: academicData.isLoaded,
      hasPrograms: !!academicData.programs
    });
    return { programs: {} };
  }

  log.debug('✅ Processing programs:', Object.keys(academicData.programs));
  const adaptedPrograms = {};

  Object.entries(academicData.programs).forEach(([programId, programData]) => {
    log.debug(`🔍 Processing program "${programId}":`, programData);
    
    // Convert our studyOverviewView to the expected semesters format
    const semesters = {};
    
    Object.entries(programData.studyOverviewView || {}).forEach(([semesterKey, semesterData]) => {
      log.debug(`  📅 Processing semester "${semesterKey}":`, semesterData);
      
      const courses = [];
      
      // Add enrolled courses (completed) - already enriched from transcript
      if (semesterData.enrolledCourses) {
        log.debug(`    ✅ Adding ${semesterData.enrolledCourses.length} enrolled courses`);
        semesterData.enrolledCourses.forEach(course => {
          courses.push({
            name: course.name || course.courseName || course.shortName || course.courseId || course.id,
            credits: parseFloat(course.credits || course.ects || 0),
            grade: course.grade || course.gradeValue,
            gradeText: course.gradeText,
            type: course.type || course.classification || 'core',
            big_type: course.big_type,
            id: course.id || course.courseId,
            courseId: course.courseId || course.id,
            courseNumber: course.courseNumber,
            isEnriched: true,
            source: 'enrolled'
          });
        });
      }
      
      // Add selected courses (planned) - use already enriched data from unifiedAcademicDataSelector
      if (semesterData.selectedCourses) {
        log.debug(`    📋 Adding ${semesterData.selectedCourses.length} selected courses (already enriched)`);
        semesterData.selectedCourses.forEach(course => {
          log.debug(`      🔍 Processing selected course:`, course);
          courses.push({
            name: course.name || course.courseId || course.id,
            credits: course.credits ?? 3, // Use nullish coalescing to preserve 0 values
            type: `${course.type || course.classification || 'elective'}-wishlist`, // Mark as wishlist type
            big_type: course.classification || course.type || 'elective',
            grade: null, // Planned courses have no grades yet
            courseId: course.courseId || course.id,
            courseNumber: course.courseId || course.id,
            semester: semesterKey,
            isEnriched: course.isEnriched !== false, // Use enrichment status from selector
            source: 'selected',
            avgRating: course.avgRating
          });
        });
      }
      
      log.debug(`    📊 Total courses for ${semesterKey}: ${courses.length}`);
      
      if (courses.length > 0) {
        semesters[semesterKey] = courses;
      }
    });

    const adaptedProgram = {
      programId,
      semesters,
      rawScorecard: programData.rawData,
      isMainProgram: programData.isMainProgram,
    };
    
    log.debug(`✅ Adapted program "${programId}":`, {
      isMainProgram: adaptedProgram.isMainProgram,
      semesterCount: Object.keys(adaptedProgram.semesters).length,
      hasRawScorecard: !!adaptedProgram.rawScorecard
    });
    
    adaptedPrograms[programId] = adaptedProgram;
  });

  const result = {
    programs: adaptedPrograms,
    overallProgress: academicData.overallProgress,
    planningContext: academicData.planningContext
  };
  
  log.debug('🎯 FINAL ADAPTED RESULT:', result);
  
  return result;
};

/**
 * Gets the main program from adapted data
 * @param {Object} adaptedData - Output from adaptAcademicDataForStudyOverview
 * @returns {Object|null} - Main program data or null if not found
 */
export const getMainProgram = (adaptedData) => {
  log.debug('🎯 [getMainProgram] FINDING MAIN PROGRAM WITH FALLBACKS');
  log.debug('Input adaptedData:', adaptedData);
  
  if (!adaptedData.programs) {
    log.debug('❌ No programs in adaptedData');
    return null;
  }
  
  const programEntries = Object.entries(adaptedData.programs);
  log.debug('Available programs:', Object.keys(adaptedData.programs));
  
  // Log each program's main status
  programEntries.forEach(([programId, programData]) => {
    log.debug(`Program "${programId}": isMainProgram = ${programData.isMainProgram}`);
  });
  
  // Strategy 1: Look for explicitly marked main program
  let selectedProgram = programEntries.find(
    ([, programData]) => programData.isMainProgram
  );
  
  if (selectedProgram) {
    log.debug('✅ Found explicitly marked main program:', selectedProgram[0]);
  } else {
    log.debug('⚠️ No explicitly marked main program found, using fallback strategies...');
    
    // Strategy 2: Look for Master or Bachelor programs
    selectedProgram = programEntries.find(([programId]) => 
      programId.toLowerCase().includes('master') || programId.toLowerCase().includes('bachelor')
    );
    
    if (selectedProgram) {
      log.debug('✅ Found Master/Bachelor program as fallback:', selectedProgram[0]);
    } else {
      log.debug('⚠️ No Master/Bachelor program found, using first available program...');
      
      // Strategy 3: Use first program in list
      selectedProgram = programEntries[0];
      
      if (selectedProgram) {
        log.debug('✅ Using first program as final fallback:', selectedProgram[0]);
      }
    }
  }
  
  const result = selectedProgram ? {
    id: selectedProgram[0],
    ...selectedProgram[1]
  } : null;
  
  log.debug('🎯 Final main program result:', result?.id || 'null');
  
  return result;
};