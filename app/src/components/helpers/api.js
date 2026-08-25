import { apiClient } from "./axiosClient";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";

export const getStudyPlan = async (token) => {
  try {
    const res = await apiClient.get("https://api.shsg.ch/study-plans", token);

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
    console.log(
      "SHSG API: running saveCourse with studyPlanId",
      studyPlanId,
      "eventId",
      eventId
    );
    const res = await apiClient.post(
      `https://api.shsg.ch/study-plans/${studyPlanId}/${eventId}`,
      {},
      token
    );
    return res.data;
  } catch (err) {
    errorHandlingService.handleError(err);
    console.error("SHSG API Call: Error saving course:", err);
  }
};

export const deleteCourse = async (
  studyPlanId,
  eventId,
  token,
  { reportErrors = true } = {}
) => {
  try {
    console.log(
      "SHSG API: running deleteCourse with studyPlanId",
      studyPlanId,
      "eventId",
      eventId
    );
    const res = await apiClient.delete(
      `https://api.shsg.ch/study-plans/${studyPlanId}/${eventId}`,
      token
    );
    console.log("SHSG API Call succesful; deleteCourse res.data", res.data);
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

