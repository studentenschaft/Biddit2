// errorHandlingService.js

import { toast } from 'react-toastify';
import ErrorToast from './ErrorToast';
import { v4 as uuidv4 } from 'uuid'; // Ensure uuid is installed
import { sanitizeHeaders } from '../helpers/sanitizeHeaders';

export const errorHandlingService = {
  handleError: (error, user = null) => {
    const errorId = uuidv4(); // Generate a unique error ID
    const errorMessage = error.response?.data?.message || error.message || 'An unexpected error occurred';
    const statusCode = error.response?.status;
    const timestamp = new Date().toISOString();

    // Sanitize headers to exclude sensitive information
    const safeHeaders = sanitizeHeaders(error.config?.headers);

    const errorDetails = {
      id: errorId,
      message: errorMessage,
      statusCode,
      url: error.config?.url,
      method: error.config?.method,
      headers: safeHeaders, // Use sanitized headers
      params: error.config?.params, // Include query parameters
      data: error.config?.data, // Include request payload
      user, // Include user information if available
      timestamp,
      stack: error.stack || null, // Include stack trace if available
    };

    toast.error(<ErrorToast error={errorDetails} />, {
      position: "top-center",
      autoClose: false,
      hideProgressBar: false,
      closeOnClick: false,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
    });
    console.error('Caught error:', errorDetails);
  },

  formatError: (error) => {
    if (typeof error === 'string') {
      return error;
    } else if (error instanceof Error) {
      return JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
      }, null, 2);
    } else {
      return JSON.stringify(error, null, 2);
    }
  },
};