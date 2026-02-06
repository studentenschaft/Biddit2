import axios from "axios";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";
import {
  getRefreshToken,
  handleAuthFailure,
} from "../auth/tokenService";

// Configuration constants
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const REQUEST_TIMEOUT = 10000; // 10 seconds

/**
 * Check if an error is retryable (transient)
 * @param {Error} error - Axios error
 * @returns {boolean} Whether the error is retryable
 */
const isRetryableError = (error) => {
  // Network errors (no response received)
  if (!error.response && error.code === "ERR_NETWORK") {
    return true;
  }

  // Timeout errors
  if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
    return true;
  }

  // Server errors (5xx) are retryable
  if (error.response?.status >= 500 && error.response?.status < 600) {
    return true;
  }

  return false;
};

/**
 * Check if the browser is online
 * @returns {boolean} Whether the browser appears to be online
 */
const isOnline = () => {
  return navigator.onLine;
};

/**
 * Event emitter for network/offline state
 */
const networkEventListeners = new Set();

export const addNetworkEventListener = (callback) => {
  networkEventListeners.add(callback);
  return () => networkEventListeners.delete(callback);
};

const emitNetworkEvent = (eventType, data = {}) => {
  networkEventListeners.forEach((callback) =>
    callback({ type: eventType, ...data }),
  );
};

/**
 * Custom axios client with automatic token refresh on 401 errors,
 * exponential backoff retry for transient errors, and request queuing
 */
class ApiClient {
  constructor() {
    // Token refresh state for request queuing
    this.isRefreshing = false;
    this.refreshSubscribers = [];
    this.consecutiveAuthFailures = 0;

    // Create axios instance with default config
    this.client = axios.create({
      timeout: REQUEST_TIMEOUT,
    });

    // Request interceptor to add auth headers
    this.client.interceptors.request.use(
      (config) => {
        // Check if offline before making request
        if (!isOnline()) {
          emitNetworkEvent("OFFLINE");
          return Promise.reject(new Error("No network connection"));
        }

        // Add default headers for SHSG API
        const defaultHeaders = {
          "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
          "X-RequestedLanguage": "EN",
          "API-Version": "1",
          "Content-Type": "application/json",
        };

        config.headers = { ...defaultHeaders, ...config.headers };

        // Initialize retry count
        config._retryCount = config._retryCount || 0;

        return config;
      },
      (error) => {
        return Promise.reject(error);
      },
    );

    // Response interceptor for handling errors with retry logic
    this.client.interceptors.response.use(
      (response) => {
        // Reset auth failure count on successful response
        this.consecutiveAuthFailures = 0;
        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        // Handle offline scenario
        if (!isOnline()) {
          emitNetworkEvent("OFFLINE");
          // Don't show error toast for offline - modal will handle it
          return Promise.reject(error);
        }

        // Handle 401 Unauthorized errors
        if (error.response?.status === 401 && !originalRequest._retry) {
          return this.handle401Error(error, originalRequest);
        }

        // Handle retryable errors with exponential backoff
        if (
          isRetryableError(error) &&
          originalRequest._retryCount < MAX_RETRIES
        ) {
          return this.retryWithBackoff(error, originalRequest);
        }

        // For non-retryable errors or max retries exceeded
        // Mark the error so ErrorHandlingService can classify it
        error._isMaxRetriesExceeded =
          originalRequest._retryCount >= MAX_RETRIES;
        error._isNetworkError = error.code === "ERR_NETWORK";
        error._isTimeoutError =
          error.code === "ECONNABORTED" || error.message?.includes("timeout");

        // Only show error for non-recoverable errors
        if (
          !error._isNetworkError ||
          originalRequest._retryCount >= MAX_RETRIES
        ) {
          errorHandlingService.handleError(error);
        }

        return Promise.reject(error);
      },
    );
  }

  /**
   * Handle 401 errors with token refresh and request queuing
   */
  async handle401Error(error, originalRequest) {
    originalRequest._retry = true;
    this.consecutiveAuthFailures++;

    // If we've had 3 consecutive auth failures, session is definitely dead
    if (this.consecutiveAuthFailures >= 3) {
      console.error("3 consecutive auth failures - session is dead");
      handleAuthFailure(
        new Error("Session expired after multiple auth failures"),
      );
      return Promise.reject(error);
    }

    // If already refreshing, queue this request
    if (this.isRefreshing) {
      return new Promise((resolve, reject) => {
        this.refreshSubscribers.push({ resolve, reject, originalRequest });
      });
    }

    this.isRefreshing = true;

    try {
      const newToken = await getRefreshToken();

      if (newToken) {
        // Reset consecutive failures on successful refresh
        this.consecutiveAuthFailures = 0;

        // Update the authorization header and retry the request
        originalRequest.headers.Authorization = `Bearer ${newToken}`;

        // Process queued requests
        this.processQueue(newToken);

        return this.client(originalRequest);
      } else {
        // Token refresh returned null - session might be expired
        this.processQueue(null, new Error("Token refresh failed"));
        handleAuthFailure(new Error("Token refresh failed"));
        return Promise.reject(error);
      }
    } catch (refreshError) {
      console.error("Token refresh failed:", refreshError);
      this.processQueue(null, refreshError);
      handleAuthFailure(refreshError);
      return Promise.reject(refreshError);
    } finally {
      this.isRefreshing = false;
      this.refreshSubscribers = [];
    }
  }

  /**
   * Process queued requests after token refresh
   */
  processQueue(newToken, error = null) {
    this.refreshSubscribers.forEach(({ resolve, reject, originalRequest }) => {
      if (error) {
        reject(error);
      } else if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        resolve(this.client(originalRequest));
      } else {
        reject(new Error("Token refresh failed"));
      }
    });
    this.refreshSubscribers = [];
  }

  /**
   * Retry a request with exponential backoff
   */
  async retryWithBackoff(error, originalRequest) {
    originalRequest._retryCount++;
    const retryCount = originalRequest._retryCount;
    const baseDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount - 1);
    const jitter = baseDelay * 0.5 * Math.random();
    const delay = baseDelay + jitter; // e.g. 1-1.5s, 2-3s, 4-6s

    console.log(
      `Retrying request (${retryCount}/${MAX_RETRIES}) after ${delay}ms:`,
      originalRequest.url,
    );

    await new Promise((resolve) => setTimeout(resolve, delay));

    // Check if we're online before retrying
    if (!isOnline()) {
      emitNetworkEvent("OFFLINE");
      return Promise.reject(error);
    }

    return this.client(originalRequest);
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

  /**
   * Reset the client state (useful for testing)
   */
  reset() {
    this.isRefreshing = false;
    this.refreshSubscribers = [];
    this.consecutiveAuthFailures = 0;
  }
}

// Create and export a singleton instance
export const apiClient = new ApiClient();

// Export the class as well for testing purposes
export { ApiClient };
