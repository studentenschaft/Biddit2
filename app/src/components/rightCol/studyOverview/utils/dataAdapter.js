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
 * @param {Object} unifiedCourseData - Optional unified course data for enrichment
 * @returns {Object} - Adapted data for ProgramOverview components
 */
export const adaptAcademicDataForStudyOverview = (academicData, unifiedCourseData = null) => {
  console.group('🔄 [dataAdapter] CONVERTING ACADEMIC DATA');
  console.log('Input academicData:', academicData);
  
  if (!academicData.isLoaded || !academicData.programs) {
    console.log('❌ Early return - data not loaded or no programs:', {
      isLoaded: academicData.isLoaded,
      hasPrograms: !!academicData.programs
    });
    console.groupEnd();
    return { programs: {} };
  }

  console.log('✅ Processing programs:', Object.keys(academicData.programs));
  const adaptedPrograms = {};

  Object.entries(academicData.programs).forEach(([programId, programData]) => {
    console.log(`🔍 Processing program "${programId}":`, programData);
    
    // Convert our studyOverviewView to the expected semesters format
    const semesters = {};
    
    Object.entries(programData.studyOverviewView || {}).forEach(([semesterKey, semesterData]) => {
      console.log(`  📅 Processing semester "${semesterKey}":`, semesterData);
      
      const courses = [];
      
      // Add enrolled courses (completed) - already enriched from transcript
      if (semesterData.enrolledCourses) {
        console.log(`    ✅ Adding ${semesterData.enrolledCourses.length} enrolled courses`);
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
        console.log(`    📋 Adding ${semesterData.selectedCourses.length} selected courses (already enriched)`);
        semesterData.selectedCourses.forEach(course => {
          console.log(`      🔍 Processing selected course:`, course);
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
      
      console.log(`    📊 Total courses for ${semesterKey}: ${courses.length}`);
      
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
    
    console.log(`✅ Adapted program "${programId}":`, {
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
  
  console.log('🎯 FINAL ADAPTED RESULT:', result);
  console.groupEnd();
  
  return result;
};

/**
 * Gets the main program from adapted data
 * @param {Object} adaptedData - Output from adaptAcademicDataForStudyOverview
 * @returns {Object|null} - Main program data or null if not found
 */
export const getMainProgram = (adaptedData) => {
  console.group('🎯 [getMainProgram] FINDING MAIN PROGRAM WITH FALLBACKS');
  console.log('Input adaptedData:', adaptedData);
  
  if (!adaptedData.programs) {
    console.log('❌ No programs in adaptedData');
    console.groupEnd();
    return null;
  }
  
  const programEntries = Object.entries(adaptedData.programs);
  console.log('Available programs:', Object.keys(adaptedData.programs));
  
  // Log each program's main status
  programEntries.forEach(([programId, programData]) => {
    console.log(`Program "${programId}": isMainProgram = ${programData.isMainProgram}`);
  });
  
  // Strategy 1: Look for explicitly marked main program
  let selectedProgram = programEntries.find(
    ([programId, programData]) => programData.isMainProgram
  );
  
  if (selectedProgram) {
    console.log('✅ Found explicitly marked main program:', selectedProgram[0]);
  } else {
    console.log('⚠️ No explicitly marked main program found, using fallback strategies...');
    
    // Strategy 2: Look for Master or Bachelor programs
    selectedProgram = programEntries.find(([programId]) => 
      programId.toLowerCase().includes('master') || programId.toLowerCase().includes('bachelor')
    );
    
    if (selectedProgram) {
      console.log('✅ Found Master/Bachelor program as fallback:', selectedProgram[0]);
    } else {
      console.log('⚠️ No Master/Bachelor program found, using first available program...');
      
      // Strategy 3: Use first program in list
      selectedProgram = programEntries[0];
      
      if (selectedProgram) {
        console.log('✅ Using first program as final fallback:', selectedProgram[0]);
      }
    }
  }
  
  const result = selectedProgram ? {
    id: selectedProgram[0],
    ...selectedProgram[1]
  } : null;
  
  console.log('🎯 Final main program result:', result?.id || 'null');
  console.groupEnd();
  
  return result;
};