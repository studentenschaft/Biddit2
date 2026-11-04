import { atom, selector } from "recoil";
import { authTokenState } from "./authAtom";
import { cisIdListSelector } from "./cisIdListSelector";
import { compareSemesterKeys, parseSemesterKey } from "../../domain/semester";
import { apiClient } from "../helpers/axiosClient";
import { myCoursesUrl, termsUrl } from "../helpers/apiEndpoints";
import { forgetCourseRatings } from "../helpers/courseSheetCache";
import { cachedRequest } from "../helpers/sessionCache";
import { log } from "../helpers/log";

// The selector below re-runs whenever the token, the term list or the rated
// courses change (several times on a cold start), so its university requests
// are memoised per session: one term-list read, one MyCourses read per term.
const ratingRequests = new Map();

const fetchTermList = (token) =>
  cachedRequest(ratingRequests, "terms", () =>
    apiClient.get(termsUrl(), token).then((res) => res.data)
  );

const fetchMyCourses = (timeSegmentId, token) =>
  cachedRequest(ratingRequests, `myCourses:${timeSegmentId}`, () =>
    apiClient.get(myCoursesUrl(timeSegmentId), token).then((res) => res.data)
  );

export const _resetRatingRequestsForTests = () => ratingRequests.clear();

export const coursesRatedState = atom({
  key: "coursesRated",
  default: selector({
    key: "coursesRated/Default",
    get: async ({ get }) => {
      const token = get(authTokenState);
      try {
        const res = await apiClient.get(
          `https://api.shsg.ch/course-ratings/of-user`,
          token
        );
        return res.data;
      } catch (err) {
        // Kill switch flipped on mid-flight: expected, not a real failure -
        // skip the console noise (see docs/adr/0001-degraded-mode-kill-switch.md).
        if (!err?.isDegradedModeError) {
          console.error("Error fetching rated courses:", err);
        }
        return [];
      }
    },
  }),
});

export const coursesTakenForRatingState = atom({
  key: "coursesTakenForRatings",
  default: selector({
    key: "coursesTakenForRatings/Default",
    get: async ({ get }) => {
      // Every Recoil dependency is read before the first await and outside the
      // try: a pending dependency throws a promise, which Recoil must see to
      // suspend and re-run this selector, not the catch below as an error.
      const token = get(authTokenState);
      const cisIdList = get(cisIdListSelector);
      const coursesRated = get(coursesRatedState) || [];
      const currentSemester = cisIdList.find(
        (term) => term.isCurrent
      )?.shortName;
      if (!currentSemester) {
        console.warn("No current semester found");
        return [];
      }

      try {
        // First get all available semesters and their TimeSegmentIds
        const termList = await fetchTermList(token);

        // replace any data.shortname entries semester name formatting (e.g., SpSXX -> FSXX, AuSXX -> HSXX)
        const semesterInfo = termList.map((semester) => {
          const oldShortName = semester.shortName;
          const normalizedShortName = semester.shortName
            .replace(/SpS(\d{2})/, "FS$1")
            .replace(/AuS(\d{2})/, "HS$1");
          return {
            ...semester,
            shortName: normalizedShortName,
            oldShortName: oldShortName,
          };
        });

        // Filter for ratable semesters and map to TimeSegmentIds
        const ratableSemesters = semesterInfo
          .filter((semester) =>
            isSemesterRatable(semester.shortName, currentSemester)
          )
          .reduce((acc, semester) => {
            if (semester && semester.shortName) {
              // Ensure semester and semester.shortName are defined
              acc[semester.shortName] = semester.timeSegmentId; // If timeSegmentId is missing, undefined will be assigned, which is acceptable.
            }
            return acc;
          }, {});

        const loadRatingCourses = async (semesterName, timeSegmentId) => {
          try {
            const data = await fetchMyCourses(timeSegmentId, token);
            return { id: semesterName, data: data || [] };
          } catch (err) {
            console.error(
              `Error loading courses for semester ${semesterName}:`,
              err
            );
            return { id: semesterName, data: [] };
          }
        };

        const data = await Promise.all(
          Object.entries(ratableSemesters).map(
            ([semesterName, timeSegmentId]) =>
              loadRatingCourses(semesterName, timeSegmentId)
          )
        );

        const newData = data
          .map((semester) => {
            if (!semester) {
              return [];
            }
            const temp = (semester.data || [])
              .map((course) => {
                if (course === null || course === undefined) {
                  return null;
                }
                if (
                  course.eventCourseNumber === null ||
                  course.eventCourseNumber === undefined
                ) {
                  return {
                    courseId: "",
                    courseName: course.eventDescription,
                    semesterName: semester.id,
                  };
                }
                return {
                  courseId: course.eventCourseNumber,
                  courseName: course.eventDescription,
                  semesterName: semester.id,
                };
              })
              .filter((course) => course !== null);
            return temp;
          })
          .flat();

        const filteredCourses = newData.filter(
          (course) => !coursesRated.includes(course.courseId)
        );

        return filteredCourses;
      } catch (err) {
        // Kill switch flipped on mid-flight: expected, not a real failure -
        // skip the console noise (see docs/adr/0001-degraded-mode-kill-switch.md).
        if (!err?.isDegradedModeError) {
          console.error("Error fetching courses for rating:", err);
        }
        return [];
      }
    },
  }),
});

export async function SubmitCourseRatingById(token, courseRating) {
  try {
    const res = await apiClient.post(
      `https://api.shsg.ch/course-ratings/`,
      courseRating,
      token
    );
    log.debug("Rating submitted successfully:", res.data);
    // Course Details caches ratings per session; show the new one next visit.
    forgetCourseRatings(courseRating.courseNumber);
    return res.data;
  } catch (err) {
    console.error("Error submitting course rating:", err);
    throw err;
  }
}

/**
 * Determines if a semester should be ratable based on current date and semester dates
 * @param {string} semesterShortName - The semester to check (e.g., "FS23")
 * @param {string} currentSemesterShortName - Current semester from cisIdList
 * @returns {boolean} - True if the semester should be ratable
 */
export const isSemesterRatable = (
  semesterShortName,
  currentSemesterShortName
) => {
  if (!semesterShortName || !currentSemesterShortName) {
    return false;
  }

  const targetSem = parseSemesterKey(semesterShortName);
  const currentSem = parseSemesterKey(currentSemesterShortName);

  if (!targetSem || !currentSem) {
    log.debug("RATINGSV2: Failed to parse semester names.");
    return false;
  }
  // Ratable: before the current semester, and at most three years back.
  if (currentSem.fullYear - targetSem.fullYear > 3) return false;
  return compareSemesterKeys(semesterShortName, currentSemesterShortName) < 0;
};
