import axios from 'axios';
import { errorHandlingService } from '../errorHandling/ErrorHandlingService';

export const fetchCurrentEnrollments = async (authToken) => {
    try {
        const response = await axios.get(`https://integration.unisg.ch/StudyApi/MyEnrollments/currentEnrollments`,
        {
        headers: {
            'X-ApplicationId': '820e077d-4c13-45b8-b092-4599d78d45ec',
            'X-RequestedLanguage': 'EN',
            'API-Version': '1',
            'Authorization': `Bearer ${authToken}`,
        },
        });
        console.log('CurrentEnrollments data fetched: ', response.data);
        return response.data;
    } catch (error) {
        console.error('Error fetching CurrentEnrollments:', error);
        //throw error;
        errorHandlingService.handleError(error);
    }
};