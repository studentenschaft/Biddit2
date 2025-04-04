// mergeWishlistedCourses.js //

/**
 * Merges wishlisted courses into the existing scorecards data.
 * 
 * @param {Object} scorecards 
 * @param {Array} studyPlan 
 * @param {Object} cisIdToSemesterNameMap 
 * @param {Function} handleError 
 * @param {String} authToken 
 * @param {String} currentSemester 
 * @param {Object} categoryTypeMap 
 * @returns {Object} The updated scorecards with wishlisted courses added.
 */

import { getLightCourseDetails } from "../helpers/api";
import { 
  isSemesterInPast,
  removeSpacesFromSemesterName 
} from "../helpers/studyOverviewHelpers";


export async function mergeWishlistedCourses(
  scorecards,
  studyPlan,
  cisIdToSemesterNameMap,
  handleError,
  authToken,
  currentSemester,
  categoryTypeMap
) {

  if (!studyPlan) {
    console.warn("Study plan is null or undefined");
    return scorecards;
  }
  if (!scorecards || typeof scorecards !== "object") {
    console.warn("Invalid scorecards structure");
    return scorecards;
  }

  const updatedScorecards = JSON.parse(JSON.stringify(scorecards));

  const cleanedCurrentSemester = removeSpacesFromSemesterName(currentSemester);
  const lightCourseCache = {};

  for (const [programName, semesterMap] of Object.entries(updatedScorecards)) {
    if (!semesterMap || typeof semesterMap !== "object") {
      console.warn("Invalid semester map structure");
      continue; 
    }

    for (const plan of studyPlan) {
      const semesterCisId = plan.id;
      const semesterLabel = cisIdToSemesterNameMap[semesterCisId] || "Unassigned";

      if (semesterCisId.includes("HS")) {
      }
      if (semesterCisId.includes("Placeholder")) {

        // TODO: Need to get correct last semester's courses (e.g., HS24 for HS25) for placeholders
        // Step 1 (if a placeholder): Look up CisIds: Is the last previous same-type semester in the cache?
        // e.g. for "HS 25 - Placeholder", find the cisID for HS24, and use that as "semesterCisID_adapted" (adjust below to use that in lightCourse interactions)
        // Step 2: If not, fetch the data and cache it. If yes, use the cached data and insert into this semester's course cache

        // Extract semester type and year from placeholder
        const semesterMatch = semesterCisId.match(/(HS|FS)\s*(\d{2})\s*-\s*Placeholder/);
        if (semesterMatch) {
          const semesterType = semesterMatch[1]; // HS or FS
          const semesterYear = parseInt(semesterMatch[2], 10); // e.g., 25
          
          // Find the most recent past semester of the same type
          let referenceSemesterId = null;
          let referenceSemesterName = null;
          let highestPastYear = 0;
          
          // Look through cisIdToSemesterNameMap for real semesters (non-placeholders)
          for (const [cisId, semName] of Object.entries(cisIdToSemesterNameMap)) {
            if (cisId.includes("Placeholder")) continue;
            
            const realSemMatch = semName.match(/(HS|FS)(\d{2})/);
            if (realSemMatch && realSemMatch[1] === semesterType) {
              const realYear = parseInt(realSemMatch[2], 10);
              if (realYear < semesterYear && realYear > highestPastYear) {
                highestPastYear = realYear;
                referenceSemesterId = cisId;
                referenceSemesterName = semName;
              }
            }
          }

          // If we found a reference semester, use its data
          if (referenceSemesterId) {
            console.log(`DEBUG mergeWishlistedCourses: For placeholder ${semesterCisId}, using reference semester ${referenceSemesterName} (${referenceSemesterId})`);
            
            // Ensure we have the reference semester data in the cache
            if (!lightCourseCache[referenceSemesterId]) {
              console.log(`DEBUG mergeWishlistedCourses: Fetching data for reference semester ${referenceSemesterName}`);
              try {
                const referenceCourseData = await getLightCourseDetails(
                  referenceSemesterId,
                  authToken
                );
                lightCourseCache[referenceSemesterId] = flattenSemesterCourses(referenceCourseData);
              } catch (error) {
                console.error(`Error fetching reference semester data for ${referenceSemesterName}:`, error);
                // Continue without reference data
                continue;
              }
            }
            
            // Use reference semester data for the placeholder
            lightCourseCache[semesterCisId] = { ...lightCourseCache[referenceSemesterId] };
            console.log(`DEBUG mergeWishlistedCourses: Copied ${Object.keys(lightCourseCache[semesterCisId]).length} courses from ${referenceSemesterName} to ${semesterCisId}`);
          } else {
            console.warn(`DEBUG mergeWishlistedCourses: No reference semester found for ${semesterCisId}`);
          }

        }




      }

      // Skip processing if semester is in the past
      if (isSemesterInPast(
        removeSpacesFromSemesterName(semesterLabel),
        removeSpacesFromSemesterName(cleanedCurrentSemester)
      )) {
        continue;
      }

      try {
        // Ensure we have fetched and cached the data
        if (!lightCourseCache[semesterCisId]) {
          
          const semesterCourseData = await getLightCourseDetails(
            semesterCisId,
            authToken
          );
          lightCourseCache[semesterCisId] = flattenSemesterCourses(semesterCourseData);
        }

        const courseDict = lightCourseCache[semesterCisId];
        // TODO: Let last fall semester be the default for the current semester
        // (needs fixing, currently it doesnt't work)

        // Step 1: Get all Semester CisIds and their names

        // Step 2: Find the latest HS or FS semester in the past (depending on selected semester)

        // Step 3: Get the course data for that semester



        if (!courseDict) continue;

        // Get or create the array for that semester
        if (!semesterMap[semesterLabel]) {
          semesterMap[semesterLabel] = [];
        }
        const existingCourses = semesterMap[semesterLabel];

        // Build a set of existing IDs for fast membership test (NEW: add courseNumber)
        const existingIds = new Set();
        existingCourses.forEach(c => {
          if (c.id) existingIds.add(c.id); // old: course.id
          if (c.courseNumber) existingIds.add(c.courseNumber); // new: courseNumber
        });

        // 6. Process each wishlisted course
        for (const courseId of plan.courses || []) {
          // Skip if already exists (enrolled or previously merged)
          // Check both course.id and course.courseNumber
          if (existingIds.has(courseId)) {
            continue;
          }

          // Lookup in the flattened dictionary
            // First try direct lookup by id
            let normalizedCourse = courseDict[courseId]; 
            
            // If not found, try looking up by courseNumber
            if (!normalizedCourse) {
            // Search through all courses in the dictionary
            for (const course of Object.values(courseDict)) {
              if (course.courseNumber === courseId) {
              normalizedCourse = course;
              break;
              }
            }
            }
          if (!normalizedCourse) {
            continue; // Not found, skip
          }
          // Look up type from categoryTypeMap using classification
          const courseType = categoryTypeMap[normalizedCourse.classification] || 'unknown';

          const wishlistItem = {
            name: normalizedCourse.shortName || courseId,
            credits: normalizedCourse.credits
              ? parseFloat(normalizedCourse.credits) / 100
              : 0,
            type: `${normalizedCourse.classification}-wishlist` || "Unknown-wishlist",
            big_type: courseType,
            id: courseId,
            courseNumber: normalizedCourse.courseNumber || courseId,
            calendarEntry: normalizedCourse.calendarEntry || [],
          };

          // Add it to the semester array
          existingCourses.push(wishlistItem);
          existingIds.add(courseId); // Keep the set in sync
          if (wishlistItem.courseNumber) {
            existingIds.add(wishlistItem.courseNumber);
          }
        }
      } catch (error) {
        console.error(`Error processing semester ${semesterLabel}:`, error);
        handleError(error);
      }
    }
  }
  return updatedScorecards;
}


/**
 * Helper: Flatten top-level courses & nested subcourses into a single dictionary.
 * Keys = courseId, Values = "normalized" course object.
 */
function flattenSemesterCourses(semesterCourseData = []) {
  const courseDict = {};

  for (const course of semesterCourseData) {
    // Main course
    courseDict[course.id] = { ...course };

    // Subcourses
    if (Array.isArray(course.courses)) {
      for (const sub of course.courses) {
        courseDict[sub.id] = {
          ...course,
          ...sub,
          credits: course.credits // preserve top-level credits if sub is missing
        };
      }
    }
  }

  return courseDict;
}