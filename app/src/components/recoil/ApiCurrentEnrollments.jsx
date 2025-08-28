import { apiClient } from "../helpers/axiosClient";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";

export const fetchCurrentEnrollments = async (authToken) => {
  try {
    const response = await apiClient.get(
      `https://integration.unisg.ch/StudyApi/MyEnrollments/currentEnrollments`,
      authToken
    );
    console.log("CurrentEnrollments data fetched: ", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching CurrentEnrollments:", error);
    //throw error;
    errorHandlingService.handleError(error);
  }
};
