import { apiClient } from "../helpers/axiosClient";
import { UNISG_API } from "../helpers/apiEndpoints";
import { log } from "../helpers/log";

/**
 * Fetches scorecard details from the API. A failure rejects without a toast;
 * useScorecardFetching reports it once for the whole fetch.
 *
 * @param {string} authToken - The authentication token for API requests.
 * @param {string} studyRegulationId - The ID of the study regulation.
 * @param {number} attempt - The attempt number for the scorecard.
 * @returns {Promise<Object>} The scorecard details.
 */
export const fetchScoreCardDetails = async (
  authToken,
  studyRegulationId,
  attempt
) => {
  const response = await apiClient.get(
    `${UNISG_API}/AchievementApi/MyScoreCards/detail/byStudyRegulationId/${studyRegulationId}/byAttempt/${attempt}`,
    authToken,
    { suppressErrorToast: true }
  );
  log.debug("ScorecardDetails data fetched: ", response.data);
  return response.data;
};
