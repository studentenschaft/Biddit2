// formatErrorDetails.js

/**
 * Formats error details into a structured string for email bodies.
 *
 * @param {Object} error - The sanitized error details object.
 * @returns {string} - The formatted error details.
 */
export const formatErrorDetails = (error) => {
    const formatObject = (obj) => {
      return JSON.stringify(obj, null, 2);
    };
  
    return `
  Error ID: ${error.id}
  Error Message: ${error.message}
  Status Code: ${error.statusCode || 'N/A'}
  Timestamp: ${error.timestamp}
  
  Error Details:
  ${formatObject({
      URL: error.url || 'N/A',
      Method: error.method || 'N/A',
      Headers: error.headers || {},
      Params: error.params || {},
      Data: error.data || {},
      User: error.user || {},
    })}
  
  Stack Trace:
  ${error.stack || 'N/A'}
  
  Additional Information:
  - Current URL: ${window.location.href}
  - User Agent: ${navigator.userAgent}
    `;
  };