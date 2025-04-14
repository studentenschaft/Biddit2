import axios from 'axios';
import { getMockScorecard } from '../testing/mockAPIService';

// error handling
import { errorHandlingService } from '../errorHandling/ErrorHandlingService';

/**
 * Fetches scorecard details either from a mock service (in dev mode) or from the actual API.
 * 
 * @param {string} authToken - The authentication token for API requests.
 * @param {string} studyRegulationId - The ID of the study regulation.
 * @param {number} attempt - The attempt number for the scorecard.
 * @param {boolean} devMode - Flag indicating whether the app is in development mode.
 * @param {string} selectedDegree - The selected degree (used in dev mode).
 * @returns {Promise<Object>} A promise that resolves to the scorecard details.
 */

export const fetchScoreCardDetails = async (authToken, studyRegulationId, attempt, devMode, selectedDegree) => {
    // Check if we're in development mode and a degree is selected
    if (devMode && selectedDegree) {
        // in devMode, use mock data from local JSON files
        return {
            success: true,
            data: await getMockScorecard(selectedDegree)
        };
    }

    // If not in dev mode, proceed with actual API call
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