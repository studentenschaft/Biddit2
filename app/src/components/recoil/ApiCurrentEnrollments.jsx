import { apiClient } from "../helpers/axiosClient";
import { UNISG_API } from "../helpers/apiEndpoints";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";
import { log } from "../helpers/log";

export const fetchCurrentEnrollments = async (authToken) => {
  try {
    const response = await apiClient.get(
      `${UNISG_API}/StudyApi/MyEnrollments/currentEnrollments`,
      authToken,
      // The catch below reports failures, so apiClient must not toast too.
      { suppressErrorToast: true }
    );
    log.debug("CurrentEnrollments data fetched: ", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching CurrentEnrollments:", error);
    //throw error;
    errorHandlingService.handleError(error);
  }
};
