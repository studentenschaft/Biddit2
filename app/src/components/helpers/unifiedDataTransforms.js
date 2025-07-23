/**
 * unifiedDataTransforms.js
 * 
 * Utility functions to transform unified course data into formats expected by 
 * StudyOverview and Transcript components. These utilities bridge the gap between
 * the new unified data structure and existing UI component expectations.
 */

/**
 * Transform unified course data to StudyOverview format
 * Converts course objects from unified data to the format expected by StudyOverview UI
 * 
 * @param {Array} unifiedCourses - Course objects from unified data.available
 * @param {string} semester - Semester short name (e.g., "HS24")
 * @returns {Array} Transformed courses for StudyOverview
 */
export const transformUnifiedToStudyOverview = (unifiedCourses, semester) => {
  if (!Array.isArray(unifiedCourses)) {
    console.warn('transformUnifiedToStudyOverview: Expected array, got:', typeof unifiedCourses);
    return [];
  }

  return unifiedCourses.map(course => {
    // Handle both nested course structure (course.courses[0]) and flat structure
    const courseData = course.courses?.[0] || course;
    
    return {
      name: course.shortName || course.name || courseData.shortName || `Course ${course.id}`,
      credits: course.credits ? course.credits / 100 : (courseData.credits ? courseData.credits / 100 : 4),
      type: `${course.classification || courseData.classification || 'elective'}-wishlist`,
      grade: null, // Wishlist courses have no grades
      courseId: course.id || courseData.id,
      courseNumber: course.courseNumber || courseData.courseNumber || course.id || courseData.id,
      big_type: course.classification || courseData.classification || 'elective',
      semester: semester,
      // Additional fields that might be useful
      description: course.description || courseData.description,
      eventCourseNumber: course.eventCourseNumber || courseData.eventCourseNumber,
      languageId: course.courseLanguage?.code || courseData.courseLanguage?.code
    };
  });
};

/**
 * Transform unified course data to Transcript wishlist format
 * Converts course objects for insertion into transcript merging logic
 * 
 * @param {Array} unifiedCourses - Course objects from unified data.available
 * @param {string} semester - Semester short name (e.g., "HS24")
 * @returns {Array} Transformed courses for Transcript wishlist
 */
export const transformUnifiedToTranscriptWishlist = (unifiedCourses, semester) => {
  if (!Array.isArray(unifiedCourses)) {
    console.warn('transformUnifiedToTranscriptWishlist: Expected array, got:', typeof unifiedCourses);
    return [];
  }

  return unifiedCourses.map(course => {
    // Handle both nested course structure (course.courses[0]) and flat structure
    const courseData = course.courses?.[0] || course;
    
    return {
      id: course.id || courseData.id,
      name: course.shortName || course.name || courseData.shortName || `Course ${course.id}`,
      credits: course.credits ? course.credits / 100 : (courseData.credits ? courseData.credits / 100 : 4),
      type: `${course.classification || courseData.classification || 'elective'}-wishlist`,
      classification: course.classification || courseData.classification || 'elective',
      semester: semester,
      courseNumber: course.courseNumber || courseData.courseNumber || course.id || courseData.id,
      // Additional fields required by transcript merging
      big_type: course.classification || courseData.classification || 'elective',
      description: course.description || courseData.description,
      eventCourseNumber: course.eventCourseNumber || courseData.eventCourseNumber
    };
  });
};

/**
 * Get all selected courses across all semesters from unified data
 * Main function to extract wishlist courses for StudyOverview and Transcript
 * 
 * @param {Object} unifiedCourseData - Complete unified course data state
 * @returns {Object} Organized course data by semester for StudyOverview
 */
export const getAllSelectedCoursesFromUnified = (unifiedCourseData) => {
  if (!unifiedCourseData?.semesters) {
    console.warn('getAllSelectedCoursesFromUnified: No semester data available');
    return {};
  }

  const result = {};

  Object.entries(unifiedCourseData.semesters).forEach(([semester, semesterData]) => {
    if (!semesterData.selectedIds || !semesterData.available) {
      // No selected courses or no available courses for this semester
      result[semester] = [];
      return;
    }

    // Find course objects that match selected IDs
    const selectedCourses = semesterData.available.filter(course => {
      const courseId = course.courseNumber || course.id;
      return semesterData.selectedIds.includes(courseId);
    });

    result[semester] = selectedCourses;
  });

  return result;
};

/**
 * Get wishlist courses formatted for StudyOverview
 * Returns data in the format expected by StudyOverview component
 * 
 * @param {Object} unifiedCourseData - Complete unified course data state
 * @returns {Object} StudyOverview-formatted data organized by program and semester
 */
export const getStudyOverviewDataFromUnified = (unifiedCourseData) => {
  const selectedCoursesBySemester = getAllSelectedCoursesFromUnified(unifiedCourseData);
  
  const studyOverviewData = {};
  
  Object.entries(selectedCoursesBySemester).forEach(([semester, courses]) => {
    studyOverviewData[semester] = transformUnifiedToStudyOverview(courses, semester);
  });

  // Wrap in program structure for UI compatibility
  // StudyOverview expects: { "Program Name": { "HS24": [...courses], "FS25": [...courses] } }
  return {
    "Main Program": studyOverviewData
  };
};

/**
 * Get wishlist courses formatted for Transcript
 * Returns flat array of courses ready for transcript merging
 * 
 * @param {Object} unifiedCourseData - Complete unified course data state
 * @returns {Array} Flat array of wishlist courses for transcript merging
 */
export const getTranscriptWishlistFromUnified = (unifiedCourseData) => {
  const selectedCoursesBySemester = getAllSelectedCoursesFromUnified(unifiedCourseData);
  
  const wishlistCourses = [];
  
  Object.entries(selectedCoursesBySemester).forEach(([semester, courses]) => {
    const transformedCourses = transformUnifiedToTranscriptWishlist(courses, semester);
    wishlistCourses.push(...transformedCourses);
  });

  return wishlistCourses;
};

/**
 * Validate unified course data structure
 * Checks if unified data has the expected structure and warns about issues
 * 
 * @param {Object} unifiedCourseData - Unified course data to validate
 * @returns {Object} Validation results with warnings and suggestions
 */
export const validateUnifiedDataStructure = (unifiedCourseData) => {
  const validation = {
    isValid: true,
    warnings: [],
    suggestions: []
  };

  // Check basic structure
  if (!unifiedCourseData) {
    validation.isValid = false;
    validation.warnings.push('Unified course data is null or undefined');
    return validation;
  }

  if (!unifiedCourseData.semesters) {
    validation.isValid = false;
    validation.warnings.push('No semesters object found in unified data');
    validation.suggestions.push('Ensure EventListContainer is running and populating unified data');
    return validation;
  }

  // Check semester data
  const semesters = Object.keys(unifiedCourseData.semesters);
  if (semesters.length === 0) {
    validation.warnings.push('No semester data available');
    validation.suggestions.push('Check if EventListContainer has loaded semester information');
  }

  // Check each semester
  semesters.forEach(semester => {
    const semesterData = unifiedCourseData.semesters[semester];
    
    if (!Array.isArray(semesterData.available)) {
      validation.warnings.push(`Semester ${semester}: No available courses array`);
    }
    
    if (!Array.isArray(semesterData.selectedIds)) {
      validation.warnings.push(`Semester ${semester}: No selectedIds array`);
    }
    
    if (semesterData.selectedIds?.length > 0 && semesterData.available?.length === 0) {
      validation.warnings.push(`Semester ${semester}: Has selected courses but no available courses`);
      validation.suggestions.push(`Check if course data loading completed for ${semester}`);
    }
    
    // Check sample course structure
    if (semesterData.available?.length > 0) {
      const sampleCourse = semesterData.available[0];
      if (!sampleCourse.shortName && !sampleCourse.name) {
        validation.warnings.push(`Semester ${semester}: Courses missing names (shortName/name fields)`);
      }
      if (!sampleCourse.credits) {
        validation.warnings.push(`Semester ${semester}: Courses missing credits information`);
      }
      if (!sampleCourse.classification) {
        validation.warnings.push(`Semester ${semester}: Courses missing classification information`);
      }
    }
  });

  return validation;
};

/**
 * Debug utility to log unified data transformation
 * Helps with debugging data flow during development
 * 
 * @param {Object} unifiedCourseData - Unified course data
 * @param {string} componentName - Name of component for logging context
 */
export const debugUnifiedDataTransformation = (unifiedCourseData, componentName = 'Unknown') => {
  console.group(`🔍 [${componentName}] Unified Data Transformation Debug`);
  
  const validation = validateUnifiedDataStructure(unifiedCourseData);
  console.log('📋 Validation Results:', validation);
  
  if (validation.isValid) {
    const selectedCourses = getAllSelectedCoursesFromUnified(unifiedCourseData);
    console.log('📚 Selected Courses by Semester:', selectedCourses);
    
    const studyOverviewData = getStudyOverviewDataFromUnified(unifiedCourseData);
    console.log('📊 StudyOverview Format:', studyOverviewData);
    
    const transcriptWishlist = getTranscriptWishlistFromUnified(unifiedCourseData);
    console.log('📜 Transcript Wishlist Format:', transcriptWishlist);
  }
  
  console.groupEnd();
};

// Default export for convenience
export default {
  transformUnifiedToStudyOverview,
  transformUnifiedToTranscriptWishlist,
  getAllSelectedCoursesFromUnified,
  getStudyOverviewDataFromUnified,
  getTranscriptWishlistFromUnified,
  validateUnifiedDataStructure,
  debugUnifiedDataTransformation
};