// mergedScorecardDataSelector.js //
// This selector combines three data sources:
// 1. Backend scorecard data (base courses)
// 2. Backend wishlist courses (from API)
// 3. Local temporary selections (from user interactions)

import { selector } from "recoil";
import { mergedScorecardBySemesterAtom } from "./mergedScorecardBySemesterAtom";
import { localSelectedCoursesSemKeyState } from "./localSelectedCoursesSemKeyAtom";
import { cloneDeep } from "lodash";
import { exerciseGroupRegex } from "../helpers/regEx";

export const mergedScorecardDataSelector = selector({
  key: "mergedScorecardDataSelector",
  get: ({ get }) => {
    // Get backend data (or empty object if not loaded yet)
    // Structure: { programName: { semesterKey: [courses] } }
    const backendMergedScorecards = get(mergedScorecardBySemesterAtom) || {};

    // Get locally selected courses organized by semester
    // Structure: { semesterKey: [courses] }
    const localSelectedBySemester = get(localSelectedCoursesSemKeyState);

    // Deep clone to avoid mutating the original data
    const finalData = cloneDeep(backendMergedScorecards);

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
          // If not in localSelected, they were removed by the user
          const localCourses = localSelectedBySemester[semesterKey] || [];
          return localCourses.some(local => local.id === course.id);
        });
      }
    }

    // PHASE 2: ADDITION PASS
    // Add any new locally selected courses that aren't in the backend data yet
    for (const [semesterKey, localCourses] of Object.entries(localSelectedBySemester)) {
      // Add these courses to every program (user hasn't assigned them yet)
      for (const [programName, semesterMap] of Object.entries(finalData)) {
        // Ensure semester array exists
        if (!semesterMap[semesterKey]) {
          semesterMap[semesterKey] = [];
        }

        // Process each local course
        localCourses.forEach((localCourse) => {
          // Check if course already exists in this semester
          const existing = semesterMap[semesterKey].some(
            (existingCourse) => existingCourse.id === localCourse.id
          );

          // If not existing, add it with wishlist formatting
          if (!existing) {
            semesterMap[semesterKey].push({
              name: localCourse.shortName || localCourse.id,
              credits: localCourse.credits ? localCourse.credits / 100 : 0, // Convert credits to proper format
              type: `${localCourse.classification}-wishlist`, // Mark as wishlist item
              grade: null, // New courses have no grade
              id: localCourse.id,
              big_type : localCourse.big_type,
              calendarEntry: localCourse.calendarEntry || [],
            });
          }
        });
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


