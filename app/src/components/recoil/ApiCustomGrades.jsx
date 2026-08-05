import { apiClient } from "../helpers/axiosClient";

// error handling
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";

const API_URL = "https://api.shsg.ch/course-grades";

export async function fetchCustomGrades(token) {
  try {
    const response = await apiClient.get(API_URL, token);
    return response.data;
  } catch (error) {
    // Kill switch flipped on mid-flight: expected, not a real failure - skip
    // the console noise (see docs/adr/0001-degraded-mode-kill-switch.md).
    if (!error?.isDegradedModeError) {
      console.error("Error fetching custom grades:", error);
      errorHandlingService.handleError(error);
    }
    return {};
  }
}

export async function updateCustomGrade(token, courseNumber, grade) {
  try {
    const response = await apiClient.post(
      API_URL,
      { courseNumber, grade },
      token
    );
    console.log("Custom grade updated:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error updating custom grade:", error);
    errorHandlingService.handleError(error);
  }
}
export async function deleteCustomGrade(token, courseNumber) {
  try {
    const response = await apiClient.delete(
      `${API_URL}/${courseNumber}`,
      token
    );
    return response.data;
  } catch (error) {
    console.error("Error deleting custom grade:", error);
    errorHandlingService.handleError(error);
  }
}
