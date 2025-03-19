import { vi, describe, it, expect, beforeEach } from 'vitest';
import axios from 'axios';
import { fetchScoreCardDetails } from '../../recoil/ApiScorecardDetails';
import { getMockScorecard } from '../../testing/mockAPIService';
import { errorHandlingService } from '../../errorHandling/ErrorHandlingService';

// Mock the dependencies
vi.mock('axios');
vi.mock('../../testing/mockAPIService');
vi.mock('../../errorHandling/ErrorHandlingService');

describe('fetchScoreCardDetails', () => {
  const mockAuthToken = 'mock-auth-token';
  const mockStudyRegulationId = 'mock-study-regulation-id';
  const mockAttempt = 1;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return mock data in development mode', async () => {
    const mockDegree = 'BIA';
    const mockScorecard = { mock: 'scorecard' };
    getMockScorecard.mockReturnValue(mockScorecard);

    const result = await fetchScoreCardDetails(mockAuthToken, mockStudyRegulationId, mockAttempt, true, mockDegree);

    expect(getMockScorecard).toHaveBeenCalledWith(mockDegree);
    expect(result).toEqual(mockScorecard);
  });

  it('should make an API call in production mode', async () => {
    const mockApiResponse = { data: { mock: 'api-response' } };
    axios.get.mockResolvedValue(mockApiResponse);

    const result = await fetchScoreCardDetails(mockAuthToken, mockStudyRegulationId, mockAttempt, false);

    expect(axios.get).toHaveBeenCalledWith(
      `https://integration.unisg.ch/AchievementApi/MyScoreCards/detail/byStudyRegulationId/${mockStudyRegulationId}/byAttempt/${mockAttempt}`,
      {
        headers: {
          'X-ApplicationId': '820e077d-4c13-45b8-b092-4599d78d45ec',
          'X-RequestedLanguage': 'EN',
          'API-Version': '1',
          'Authorization': `Bearer ${mockAuthToken}`,
        },
      }
    );
    expect(result).toEqual(mockApiResponse.data);
  });

  it('should handle network errors', async () => {
    const mockError = new Error('Network error');
    axios.get.mockRejectedValue(mockError);

    await fetchScoreCardDetails(mockAuthToken, mockStudyRegulationId, mockAttempt, false);

    expect(errorHandlingService.handleError).toHaveBeenCalledWith(mockError);
  });

  it('should handle invalid responses', async () => {
    const mockInvalidResponse = { data: null };
    axios.get.mockResolvedValue(mockInvalidResponse);
  
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  
    const result = await fetchScoreCardDetails(mockAuthToken, mockStudyRegulationId, mockAttempt, false);
  
    expect(result).toBeNull();
    expect(consoleSpy).not.toHaveBeenCalled();
  
    consoleSpy.mockRestore();
  });
});