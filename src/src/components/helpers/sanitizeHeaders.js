// sanitizeHeaders.js

/**
 * Sanitizes headers by removing or masking sensitive information in a case-insensitive manner.
 *
 * @param {Object} headers - The headers object from the request.
 * @returns {Object} - The sanitized headers.
 */
export const sanitizeHeaders = (headers = {}) => {
  // List of sensitive headers to exclude or mask (all in lowercase)
  const sensitiveHeaders = ['authorization', 'cookie', 'set-cookie'];

  const sanitized = {};

  Object.keys(headers).forEach((header) => {
    // Check if the header is sensitive (case-insensitive)
    if (sensitiveHeaders.includes(header.toLowerCase())) {
      sanitized[header] = '****'; // Mask the sensitive header value
    } else {
      sanitized[header] = headers[header];
    }
  });

  return sanitized;
};