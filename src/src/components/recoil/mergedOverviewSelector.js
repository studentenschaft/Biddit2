// mergedOverviewSelector.js //
// This selector combines three data sources:
// 1. Backend scorecard data (base courses)
// 2. Backend wishlist courses (from API)
// 3. Local temporary selections (from user interactions)

import { selector } from "recoil";
import { mergedScorecardBySemesterAtom } from "./mergedScorecardBySemesterAtom";
import { localSelectedCoursesSemKeyState } from "./localSelectedCoursesSemKeyAtom";
import { exerciseGroupRegex } from "../helpers/regEx";
// Remove cloneDeep import as we won't need it anymore

/**
 * Build a Map of locally selected courses by ID for O(1) lookups
 */
const buildLocalSelectedMaps = (localSelectedBySemester) => {
  const localSelectedMaps = {};
  
  for (const [semesterKey, courses] of Object.entries(localSelectedBySemester)) {
    // Create a Set for each semester
    localSelectedMaps[semesterKey] = new Set(
      courses.map(course => course.id)
    );
  }
  
  return localSelectedMaps;
};

export const mergedOverviewSelector = selector({
  key: "mergedOverviewSelector",
  get: ({ get }) => {
    // Get backend data (or empty object if not loaded yet)
    // Structure: { programName: { semesterKey: [courses] } }
    const backendMergedScorecards = get(mergedScorecardBySemesterAtom) || {};

    // Get locally selected courses organized by semester
    // Structure: { semesterKey: [courses] }
    const localSelectedBySemester = get(localSelectedCoursesSemKeyState);

    // Build optimized data structures for O(1) lookups
    const localSelectedMaps = buildLocalSelectedMaps(localSelectedBySemester);

    // Replace deep clone with selective cloning
    const finalData = {};
    for (const [programName, semesterMap] of Object.entries(backendMergedScorecards)) {
      finalData[programName] = {};
      for (const [semesterKey, courses] of Object.entries(semesterMap)) {
        // Clone only the course arrays and do shallow clone of each course object
        // This is sufficient since we only modify top-level properties of course objects
        finalData[programName][semesterKey] = courses.map(course => ({...course}));
      }
    }

    // PHASE 1: REMOVAL PASS
    // Iterate through all programs and their semester maps
    for (const [programName, semesterMap] of Object.entries(finalData)) {
      // For each semester in the program
      for (const [semesterKey, courses] of Object.entries(semesterMap)) {
        // Filter the courses array to remove unwanted wishlist items
        semesterMap[semesterKey] = courses.filter(course => {
          // Always keep regular courses (non-wishlist)
          if (!course.type?.endsWith('-wishlist')) return true;
          
          // For wishlist courses, check if they exist in local selections 
          const localCoursesSet = localSelectedMaps[semesterKey];
          return localCoursesSet && localCoursesSet.has(course.id);
        });
      }
    }

    // PHASE 2: ADDITION PASS - OPTIMIZED
    // Create a program-course existence map for all semesters at once
    const programCourseExistence = {};
    
    // Initialize existence tracking structure
    for (const [programName, semesterMap] of Object.entries(finalData)) {
      programCourseExistence[programName] = {};
      
      for (const [semKey, courses] of Object.entries(semesterMap)) {
        // Create a set of existing course IDs for O(1) lookup
        programCourseExistence[programName][semKey] = new Set(
          courses.map(course => course.id)
        );
        
        // Ensure all semester arrays exist in the final data structure
        if (!semesterMap[semKey]) {
          semesterMap[semKey] = [];
        }
      }
    }

    // Add any locally selected courses not in backend data
    for (const [semesterKey, localCourses] of Object.entries(localSelectedBySemester)) {
      // Process each local course once
      for (const localCourse of localCourses) {
        // Check each program once per course
        for (const [programName, semesterMap] of Object.entries(finalData)) {
          // Initialize semester key if it doesn't exist
          if (!semesterMap[semesterKey]) {
            semesterMap[semesterKey] = [];
            programCourseExistence[programName] = programCourseExistence[programName] || {};
            programCourseExistence[programName][semesterKey] = new Set();
          }
          
          // Check if course exists  from prepared map
          const courseExists = programCourseExistence[programName][semesterKey]?.has(localCourse.id) || false;
          
          if (!courseExists) {
            semesterMap[semesterKey].push({
              name: localCourse.shortName || localCourse.id,
              credits: localCourse.credits ? localCourse.credits / 100 : 0,
              type: `${localCourse.classification}-wishlist`,
              grade: null,
              id: localCourse.id,
              big_type: localCourse.big_type,
              calendarEntry: localCourse.calendarEntry || [],
            });
            
            // Update our existence tracking after adding the course
            if (programCourseExistence[programName][semesterKey]) {
              programCourseExistence[programName][semesterKey].add(localCourse.id);
            }
          }
        }
      }
    }

    // Phase 2.5 Remove Credits for Exercise Groups
    for (const [programName, semesterMap] of Object.entries(finalData)) {
      for (const [semesterKey, courses] of Object.entries(semesterMap)) {
        semesterMap[semesterKey] = courses.map(course => {
          if (course.name) { // if name is not null, try match
            const match = course.name.match(exerciseGroupRegex);
            if (match) {
              course.credits = 0;
            }
          }
          return course;
        });
      }
    }
    
    // PHASE 3: SORTING PASS
    const typePriority = {
        'core': 1,
        'elective': 2,
        'contextual': 3
      };
  
      for (const [programName, semesterMap] of Object.entries(finalData)) {
        for (const [semesterKey, courses] of Object.entries(semesterMap)) {
          semesterMap[semesterKey] = courses.sort((a, b) => {
            const typeA = a.big_type || '';
            const typeB = b.big_type || '';
            const priorityA = typePriority[typeA] || 999;
            const priorityB = typePriority[typeB] || 999;
            return priorityA - priorityB;
          });
        }
      }

    return finalData;
  },
});


