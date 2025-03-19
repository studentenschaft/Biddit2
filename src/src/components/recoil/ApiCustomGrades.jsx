import axios from 'axios';

// error handling
import { errorHandlingService } from '../errorHandling/ErrorHandlingService';


const API_URL = 'https://api.shsg.ch/course-grades';

export async function fetchCustomGrades(token) {
  try {
    const response = await axios.get(API_URL, {
      headers: {
        'X-ApplicationId': '820e077d-4c13-45b8-b092-4599d78d45ec',
        'X-RequestedLanguage': 'EN',
        'API-Version': '1',
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching custom grades:', error);
    errorHandlingService.handleError(error);
    return {};
  }
}

export async function updateCustomGrade(token, courseNumber, grade) {
  try {
    const response = await axios.post(
      API_URL,
      { courseNumber, grade },
      {
        headers: {
          'X-ApplicationId': '820e077d-4c13-45b8-b092-4599d78d45ec',
          'X-RequestedLanguage': 'EN',
          'API-Version': '1',
          Authorization: `Bearer ${token}`,
        },
      }
    );
    console.log("Custom grade updated:", response.data);
    return response.data;
  } catch (error) {
    console.error('Error updating custom grade:', error);
    errorHandlingService.handleError(error);
  }
}
export async function deleteCustomGrade(token, courseNumber) {
  try {
    const response = await axios.delete(`${API_URL}/${courseNumber}`, {
      headers: {
        'X-ApplicationId': '820e077d-4c13-45b8-b092-4599d78d45ec',
        'X-RequestedLanguage': 'EN',
        'API-Version': '1',
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error deleting custom grade:', error);
    errorHandlingService.handleError(error);
  }
}