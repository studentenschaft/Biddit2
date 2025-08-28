import { apiClient } from "../helpers/axiosClient";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";

export const fetchScoreCardEnrollments = async (authToken) => {
  try {
    const response = await apiClient.get(
      "https://integration.unisg.ch/AchievementApi/MyScoreCards/studiesWithProgramEnrollmentStatus",
      authToken
    );
    console.log("Enrollments data fetched: ", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching scorecard enrollments:", error);
    //throw error;
    errorHandlingService.handleError(error);
  }
};
