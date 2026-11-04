// Course sheets (per offering) and per-course SHSG ratings, fetched once per
// session. Course Details remounts on every tab visit; without this cache each
// visit and each re-selection downloaded the same sheet and ratings again.
// Failures reject (and are not cached) so the caller owns the one error toast.
import { apiClient } from "./axiosClient";
import { SHSG_API, UNISG_API } from "./apiEndpoints";
import { cachedRequest } from "./sessionCache";
import { courseKey } from "../../domain/course";

// Requested to be hidden from the ratings shown in Course Details.
const HIDDEN_RATING_COURSE_NUMBERS = new Set(["7,721,1.00"]);

const sheets = new Map();
const ratings = new Map();

const sheetUrl = (id) =>
  `${UNISG_API}/EventApi/CourseInformationSheets/latestPublishedByHsgEntityId/${id}`;
const ratingsUrl = (courseNumber) =>
  `${SHSG_API}/course-ratings/by-course/${courseNumber}`;

const requestSheet = async (id, authToken) => {
  const response = await apiClient.get(sheetUrl(id), authToken, {
    headers: { "API-Version": "3" },
    suppressErrorToast: true,
  });
  return response.data ?? null;
};

/**
 * Looks the sheet up by HSG entity id first and by course number when that
 * fails. Rejects with the course-number lookup's error when both fail.
 * @param {{ course: object, authToken: string }} params
 * @returns {Promise<object|null>}
 */
export const getCourseSheet = ({ course, authToken }) => {
  const load = () =>
    requestSheet(course.hsgEntityId, authToken).catch(() =>
      requestSheet(courseKey(course), authToken)
    );
  // Keyed by the id the primary lookup sends; a course with no id is not cached.
  const key = course.hsgEntityId || courseKey(course);
  return key ? cachedRequest(sheets, key, load) : load();
};

/**
 * @param {{ courseNumber: string, authToken: string }} params
 * @returns {Promise<Array>} rating entries for the course (empty when unrated)
 */
export const getCourseRatings = ({ courseNumber, authToken }) =>
  cachedRequest(ratings, courseNumber, async () => {
    const response = await apiClient.get(ratingsUrl(courseNumber), authToken, {
      suppressErrorToast: true,
    });
    return (response.data || []).filter(
      (entry) => !HIDDEN_RATING_COURSE_NUMBERS.has(entry.courseNumber)
    );
  });

/** Drops a course's cached ratings, e.g. after the user rated it. */
export const forgetCourseRatings = (courseNumber) => ratings.delete(courseNumber);

export const _resetForTests = () => {
  sheets.clear();
  ratings.clear();
};
