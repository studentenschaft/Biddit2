import axios from "axios";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";
import { getRefreshToken, handleAuthFailure } from "../auth/tokenService";

/**
 * Custom axios client with automatic token refresh on 401 errors
 */
class ApiClient {
  constructor() {
    // Create axios instance with default config
    this.client = axios.create({
      timeout: 10000, // 10 second timeout
    });

    // Request interceptor to add auth headers
    this.client.interceptors.request.use(
      (config) => {
        // Add default headers for SHSG API
        const defaultHeaders = {
          "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
          "X-RequestedLanguage": "EN",
          "API-Version": "1",
          "Content-Type": "application/json",
        };

        config.headers = { ...defaultHeaders, ...config.headers };
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for handling 401 errors
    this.client.interceptors.response.use(
      (response) => {
        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        // Check if error is 401 and we haven't already tried to refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            // Try to refresh the token
            const newToken = await getRefreshToken();

            if (newToken) {
              // Update the authorization header and retry the request
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            console.error("Token refresh failed:", refreshError);
            // Redirect to login or handle authentication failure
            handleAuthFailure(refreshError);
            return Promise.reject(refreshError);
          }
        }

        // For non-401 errors or if token refresh failed, use existing error handling
        errorHandlingService.handleError(error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Make a GET request with automatic token handling
   * @param {string} url - The URL to request
   * @param {string} token - Authentication token
   * @param {Object} config - Additional axios config
   * @returns {Promise} Axios response
   */
  async get(url, token, config = {}) {
    return this.client.get(url, {
      ...config,
      headers: {
        Authorization: `Bearer ${token}`,
        ...config.headers,
      },
    });
  }

  /**
   * Make a POST request with automatic token handling
   * @param {string} url - The URL to request
   * @param {Object} data - Request body data
   * @param {string} token - Authentication token
   * @param {Object} config - Additional axios config
   * @returns {Promise} Axios response
   */
  async post(url, data, token, config = {}) {
    return this.client.post(url, data, {
      ...config,
      headers: {
        Authorization: `Bearer ${token}`,
        ...config.headers,
      },
    });
  }

  /**
   * Make a PUT request with automatic token handling
   * @param {string} url - The URL to request
   * @param {Object} data - Request body data
   * @param {string} token - Authentication token
   * @param {Object} config - Additional axios config
   * @returns {Promise} Axios response
   */
  async put(url, data, token, config = {}) {
    return this.client.put(url, data, {
      ...config,
      headers: {
        Authorization: `Bearer ${token}`,
        ...config.headers,
      },
    });
  }

  /**
   * Make a DELETE request with automatic token handling
   * @param {string} url - The URL to request
   * @param {string} token - Authentication token
   * @param {Object} config - Additional axios config
   * @returns {Promise} Axios response
   */
  async delete(url, token, config = {}) {
    return this.client.delete(url, {
      ...config,
      headers: {
        Authorization: `Bearer ${token}`,
        ...config.headers,
      },
    });
  }
}

// Create and export a singleton instance
export const apiClient = new ApiClient();

// Export the class as well for testing purposes
export { ApiClient };
