import axios from 'axios';
import { errorHandlingService } from '../errorHandling/ErrorHandlingService';

export const getStudyPlan = async (token) => {
  try {
    const res = await axios.get('https://api.shsg.ch/study-plans', {
      headers: {
        'X-ApplicationId': '820e077d-4c13-45b8-b092-4599d78d45ec',
        'X-RequestedLanguage': 'EN',
        'API-Version': '1',
        Authorization: `Bearer ${token}`,
      },
    });

    const studyPlansData = res.data;

    // Convert the object into an array of study plan objects
    const studyPlansArray = Object.keys(studyPlansData).map((key) => ({
      id: key,
      courses: studyPlansData[key],
    }));

    return studyPlansArray;
  } catch (err) {
    errorHandlingService.handleError(err);
    console.error('SHSG API Call: Error fetching study plans:', err);
    return []; // Return an empty array on error
  }
};

export const getStudyPlanCourses = async (studyPlanId, token) => {
  try {
    const res = await axios.get(`https://api.shsg.ch/study-plans/${studyPlanId}`, {
      headers: {
        'X-ApplicationId': '820e077d-4c13-45b8-b092-4599d78d45ec',
        'X-RequestedLanguage': 'EN',
        'API-Version': '1',
        Authorization: `Bearer ${token}`,
      },
    });
    return res.data;
  } catch (err) {
    errorHandlingService.handleError(err);
    console.error('SHSG API Call: Error fetching study plan courses:', err);
  }
};

export const saveCourse = async (studyPlanId, eventId, token) => {
  try {
    console.log("SHSG API: running saveCourse with studyPlanId", studyPlanId, "eventId", eventId);
    const res = await axios.post(
      `https://api.shsg.ch/study-plans/${studyPlanId}/${eventId}`,
      {},
      {
        headers: {
          'X-ApplicationId': '820e077d-4c13-45b8-b092-4599d78d45ec',
          'X-RequestedLanguage': 'EN',
          'API-Version': '1',
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.data;
  } catch (err) {
    errorHandlingService.handleError(err);
    console.error('SHSG API Call: Error saving course:', err);
  }
};

export const deleteCourse = async (studyPlanId, eventId, token) => {
  try {
    console.log("SHSG API: running deleteCourse with studyPlanId", studyPlanId, "eventId", eventId);
    const res = await axios.delete(
      `https://api.shsg.ch/study-plans/${studyPlanId}/${eventId}`,
      {
        headers: {
          'X-ApplicationId': '820e077d-4c13-45b8-b092-4599d78d45ec',
          'X-RequestedLanguage': 'EN',
          'API-Version': '1',
          Authorization: `Bearer ${token}`,
        },
      }
    );
    console.log("SHSG API Call succesful; deleteCourse res.data", res.data);
    return res.data;
  } catch (err) {
    errorHandlingService.handleError(err);
    console.error('SHSG API Call: Error deleting course:', err);
  }
};


export const getLightCourseDetails = async (cisTermId, token) => {
  try {
    const res = await axios.get(
      `https://integration.unisg.ch/EventApi/CourseInformationSheets/myLatestPublishedPossiblebyTerm/${cisTermId}/?fields=id,shortName,credits,classification,courses`,
      {
        headers: {
          'X-ApplicationId': '820e077d-4c13-45b8-b092-4599d78d45ec',
          'X-RequestedLanguage': 'EN',
          'API-Version': '1',
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.data;
  } catch (err) {
    errorHandlingService.handleError(err);
    console.error('Error fetching course details:', err);
    return null;
  }
};