import { apiClient } from "./axiosClient";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";

/**
 * Initialize a new semester in the study plan with an empty course array
 * @param {string} semesterIdentifier - semester shortName (e.g., "FS 24") or semesterId
 * @param {string} token - authentication token
 * @returns {Promise<Object>} - The updated semesters data
 */
export const initializeSemester = async (semesterIdentifier, token) => {
  try {
    console.log(`Initializing semester: ${semesterIdentifier}`);

    // We'll pass an empty array as courseIds to create the semester without courses
    const res = await apiClient.post(
      `https://api.shsg.ch/study-plans/${semesterIdentifier}`,
      { courseIds: [] },
      token
    );

    console.log(`Semester ${semesterIdentifier} initialized successfully`);
    return res.data;
  } catch (err) {
    errorHandlingService.handleError(err);
    console.error(`Error initializing semester ${semesterIdentifier}:`, err);
    throw err;
  }
};

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
    errorHandlingService.handleError(err);
    console.error("SHSG API Call: Error fetching study plans:", err);
    return []; // Return an empty array on error
  }
};

export const getStudyPlanCourses = async (studyPlanId, token) => {
  try {
    const res = await apiClient.get(
      `https://api.shsg.ch/study-plans/${studyPlanId}`,
      token
    );
    return res.data;
  } catch (err) {
    errorHandlingService.handleError(err);
    console.error("SHSG API Call: Error fetching study plan courses:", err);
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

export const deleteCourse = async (studyPlanId, eventId, token) => {
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
    return res.data;
  } catch (err) {
    errorHandlingService.handleError(err);
    console.error("SHSG API Call: Error deleting course:", err);
  }
};

export const getLightCourseDetails = async (cisTermId, token) => {
  try {
    const res = await apiClient.get(
      `https://integration.unisg.ch/EventApi/CourseInformationSheets/myLatestPublishedPossiblebyTerm/${cisTermId}/?fields=id,shortName,credits,classification,courses`,
      token
    );
    return res.data;
  } catch (err) {
    errorHandlingService.handleError(err);
    console.error("Error fetching course details:", err);
    return null;
  }
};
