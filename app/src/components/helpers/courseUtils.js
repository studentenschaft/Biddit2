/**
 * Utility functions for course data manipulation.
 * Extracted from useUnifiedCourseData.js to eliminate duplication and improve testability.
 */

/**
 * Extracts a unique identifier from a course object.
 * Handles various course data structures from different API responses.
 *
 * Priority order:
 * 1. Nested courseNumber from courses array (courses[0].courseNumber)
 * 2. eventCourseNumber (from enrollment data)
 * 3. Direct courseNumber property
 * 4. id property
 * 5. number property
 * 6. _id property (MongoDB style)
 *
 * @param {Object|null|undefined} course - The course object to extract identifier from
 * @returns {string|null} The course identifier or null if not found
 */
export function getCourseIdentifier(course) {
  if (!course) return null;

  // Priority 1: Nested courseNumber from courses array
  const nestedCourseNumber = course.courses?.[0]?.courseNumber;
  if (nestedCourseNumber) return nestedCourseNumber;

  // Priority 2: eventCourseNumber (from enrollment API)
  if (course.eventCourseNumber) return course.eventCourseNumber;

  // Priority 3: Direct courseNumber
  if (course.courseNumber) return course.courseNumber;

  // Priority 4: id property
  if (course.id) return course.id;

  // Priority 5: number property
  if (course.number) return course.number;

  // Priority 6: _id (MongoDB style)
  if (course._id) return course._id;

  return null;
}

/**
 * Sorts courses by enrollment and selection status.
 * Order: enrolled first, then selected, then everything else.
 * Maintains relative order within each group (stable sort).
 *
 * @param {Array} courses - Array of course objects with enrolled/selected properties
 * @returns {Array} New sorted array (does not mutate original)
 */
export function sortCoursesByStatus(courses) {
  if (!courses || courses.length === 0) return [];

  // Create a copy to avoid mutating the original array
  return [...courses].sort((a, b) => {
    const aEnrolled = !!a.enrolled;
    const bEnrolled = !!b.enrolled;
    const aSelected = !!a.selected;
    const bSelected = !!b.selected;

    // Priority 1: Enrolled courses first
    if (aEnrolled && !bEnrolled) return -1;
    if (!aEnrolled && bEnrolled) return 1;

    // Priority 2: Among non-enrolled, selected courses come first
    if (!aEnrolled && !bEnrolled) {
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
    }

    // If same status, maintain original order (stable sort)
    return 0;
  });
}

/**
 * Looks up a course rating from a ratings map using multiple matching strategies.
 * Tries different course properties to find a matching rating.
 *
 * Priority order:
 * 1. Direct course.id match
 * 2. courseNumber match
 * 3. Nested courses[0].courseNumber match
 * 4. shortName match
 * 5. Alternative properties (_id, number, title, name)
 *
 * @param {Object|null|undefined} course - The course object to find rating for
 * @param {Object|null|undefined} ratingsMap - Map of course identifiers to ratings
 * @returns {number|null} The rating value or null if not found
 */
export function lookupCourseRating(course, ratingsMap) {
  if (!course || !ratingsMap) return null;

  // Method 1: Direct course ID match
  if (course.id && ratingsMap[course.id] !== undefined) {
    return ratingsMap[course.id];
  }

  // Method 2: Course number match (direct property)
  if (course.courseNumber && ratingsMap[course.courseNumber] !== undefined) {
    return ratingsMap[course.courseNumber];
  }

  // Method 3: Course number match (nested in courses array)
  const nestedCourseNumber = course.courses?.[0]?.courseNumber;
  if (nestedCourseNumber && ratingsMap[nestedCourseNumber] !== undefined) {
    return ratingsMap[nestedCourseNumber];
  }

  // Method 4: Try course shortName
  if (course.shortName && ratingsMap[course.shortName] !== undefined) {
    return ratingsMap[course.shortName];
  }

  // Method 5: Try alternative properties
  const possibleKeys = [course._id, course.number, course.title, course.name];
  for (const key of possibleKeys) {
    if (key && ratingsMap[key] !== undefined) {
      return ratingsMap[key];
    }
  }

  return null;
}
