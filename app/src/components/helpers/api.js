import { apiClient } from "./axiosClient";
import { SHSG_API } from "./apiEndpoints";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";
import { log } from "./log";

export const getStudyPlan = async (token) => {
  try {
    const res = await apiClient.get(`${SHSG_API}/study-plans`, token);

    const studyPlansData = res.data;

    // Convert the object into an array of study plan objects
    const studyPlansArray = Object.keys(studyPlansData).map((key) => ({
      id: key,
      courses: studyPlansData[key],
    }));

    return studyPlansArray;
  } catch (err) {
    // Throws instead of reporting: the caller decides how to surface this, so
    // the user gets one error UI rather than a toast plus whatever else.
    console.error("SHSG API Call: Error fetching study plans:", err);
    throw err;
  }
};

export const saveCourse = async (studyPlanId, eventId, token) => {
  try {
    log.debug(
      "SHSG API: running saveCourse with studyPlanId",
      studyPlanId,
      "eventId",
      eventId
    );
    // The catch below reports failures, so apiClient must not toast too.
    await apiClient.post(
      `${SHSG_API}/study-plans/${studyPlanId}/${eventId}`,
      {},
      token,
      { suppressErrorToast: true }
    );
    return true;
  } catch (err) {
    errorHandlingService.handleError(err);
    console.error("SHSG API Call: Error saving course:", err);
    return false;
  }
};

export const deleteCourse = async (
  studyPlanId,
  eventId,
  token,
  { reportErrors = true } = {}
) => {
  try {
    log.debug(
      "SHSG API: running deleteCourse with studyPlanId",
      studyPlanId,
      "eventId",
      eventId
    );
    // Failures are reported below (or counted by bulk callers), never by
    // apiClient: a bulk wipe must not stack one toast per course.
    const res = await apiClient.delete(
      `${SHSG_API}/study-plans/${studyPlanId}/${eventId}`,
      token,
      { suppressErrorToast: true }
    );
    log.debug("SHSG API Call succesful; deleteCourse res.data", res.data);
    return true;
  } catch (err) {
    // Never rethrows: callers delete speculatively under several id formats, so
    // a 404 on the wrong one is expected. Bulk callers pass reportErrors: false
    // and report once from the returned count.
    if (reportErrors) errorHandlingService.handleError(err);
    console.error("SHSG API Call: Error deleting course:", err);
    return false;
  }
};

