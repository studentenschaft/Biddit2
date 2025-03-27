import { useCallback } from 'react';
import { errorHandlingService } from './ErrorHandlingService';

export const useErrorHandler = () => {
  const handleError = useCallback(   // Memoized handleError
    (error) => {
      errorHandlingService.handleError(error);
    },
    [] // Empty dependency array since errorHandlingService is assumed to be stable
  );

  return handleError;
};