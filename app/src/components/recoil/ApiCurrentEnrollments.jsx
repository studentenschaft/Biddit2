import { apiClient } from "../helpers/axiosClient";
import { UNISG_API } from "../helpers/apiEndpoints";
import { log } from "../helpers/log";

export const fetchCurrentEnrollments = async (authToken) => {
  const response = await apiClient.get(
    `${UNISG_API}/StudyApi/MyEnrollments/currentEnrollments`,
    authToken,
    // useScorecardFetching reports failures, so apiClient must not toast too.
    { suppressErrorToast: true }
  );
  log.debug("CurrentEnrollments data fetched: ", response.data);
  return response.data;
};
