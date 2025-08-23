import axios from 'axios';

// error handling
import { errorHandlingService } from '../errorHandling/ErrorHandlingService';

/**
 * Fetches scorecard details from the API.
 * 
 * @param {string} authToken - The authentication token for API requests.
 * @param {string} studyRegulationId - The ID of the study regulation.
 * @param {number} attempt - The attempt number for the scorecard.
 * @returns {Promise<Object>} A promise that resolves to the scorecard details.
 */

export const fetchScoreCardDetails = async (authToken, studyRegulationId, attempt) => {
    // Proceed with API call
    try {
        const response = await axios.get(`https://integration.unisg.ch/AchievementApi/MyScoreCards/detail/byStudyRegulationId/${studyRegulationId}/byAttempt/${attempt}`,
        {
        headers: {
            'X-ApplicationId': '820e077d-4c13-45b8-b092-4599d78d45ec',
            'X-RequestedLanguage': 'EN',
            'API-Version': '1',
            'Authorization': `Bearer ${authToken}`,
        },
        });
         // Log the fetched data for debugging purposes
        console.log('ScorecardDetails data fetched: ', response.data);
        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        console.error('Error fetching ScorecardDetails:', error);
        errorHandlingService.handleError(error);
        return {
            success: false,
            error: 'Failed to load scorecard data'
        };
    }
};