// errorHandlingService.js

import { toast } from "react-toastify";
import ErrorToast from "./ErrorToast";
import { v4 as uuidv4 } from "uuid"; // Ensure uuid is installed
import { sanitizeHeaders } from "../helpers/sanitizeHeaders";

/**
 * Error classification types
 */
const ErrorType = {
  NETWORK: "NETWORK", // No internet connection
  TIMEOUT: "TIMEOUT", // Request timeout
  AUTH: "AUTH", // Authentication errors (401, token issues)
  SERVER: "SERVER", // Server errors (5xx)
  CLIENT: "CLIENT", // Client errors (4xx except 401)
  MSAL: "MSAL", // MSAL/Azure AD errors
  UNKNOWN: "UNKNOWN", // Unknown errors
};

/**
 * Classify an error to determine how to handle it
 * @param {Error} error - The error to classify
 * @returns {{ type: string, isRecoverable: boolean, shouldShowToast: boolean }}
 */
const classifyError = (error) => {
  const statusCode = error.response?.status;
  const errorCode = error.code;
  const errorMessage = error.message || "";

  // Network errors - handled by offline modal
  if (errorCode === "ERR_NETWORK" || error._isNetworkError) {
    return {
      type: ErrorType.NETWORK,
      isRecoverable: true,
      shouldShowToast: false, // Offline modal handles this
    };
  }

  // MSAL/Authentication errors - check BEFORE timeout since MSAL errors may contain "timeout"
  if (
    errorMessage.includes("monitor_window_timeout") ||
    errorMessage.includes("popup_window_error") ||
    errorMessage.includes("interaction_in_progress") ||
    errorMessage.includes("Token acquisition") ||
    error.name === "BrowserAuthError" ||
    error.name === "InteractionRequiredAuthError"
  ) {
    return {
      type: ErrorType.MSAL,
      isRecoverable: true,
      shouldShowToast: false, // Session modal handles this
    };
  }

  // Timeout errors - may be recoverable with retry (check AFTER MSAL)
  if (
    errorCode === "ECONNABORTED" ||
    errorMessage.includes("timeout") ||
    error._isTimeoutError
  ) {
    return {
      type: ErrorType.TIMEOUT,
      isRecoverable: !error._isMaxRetriesExceeded,
      shouldShowToast: error._isMaxRetriesExceeded, // Only show after max retries
    };
  }

  // 401 Unauthorized - handled by token refresh logic
  if (statusCode === 401) {
    return {
      type: ErrorType.AUTH,
      isRecoverable: true,
      shouldShowToast: false, // Session modal handles this after retries fail
    };
  }

  // Server errors (5xx) - may be recoverable with retry
  if (statusCode >= 500 && statusCode < 600) {
    return {
      type: ErrorType.SERVER,
      isRecoverable: !error._isMaxRetriesExceeded,
      shouldShowToast: error._isMaxRetriesExceeded,
    };
  }

  // Client errors (4xx except 401) - not recoverable
  if (statusCode >= 400 && statusCode < 500) {
    return {
      type: ErrorType.CLIENT,
      isRecoverable: false,
      shouldShowToast: true,
    };
  }

  // Unknown errors - show toast
  return {
    type: ErrorType.UNKNOWN,
    isRecoverable: false,
    shouldShowToast: true,
  };
};

export const errorHandlingService = {
  handleError: (error, user = null) => {
    const errorId = uuidv4();
    const errorMessage =
      error.response?.data?.message ||
      error.message ||
      "An unexpected error occurred";
    const statusCode = error.response?.status;
    const timestamp = new Date().toISOString();

    // Classify the error
    const classification = classifyError(error);

    // Sanitize headers to exclude sensitive information
    const safeHeaders = sanitizeHeaders(error.config?.headers);

    const errorDetails = {
      id: errorId,
      message: errorMessage,
      statusCode,
      url: error.config?.url,
      method: error.config?.method,
      headers: safeHeaders,
      params: error.config?.params,
      data: error.config?.data,
      user,
      timestamp,
      stack: error.stack || null,
      // Add classification info
      errorType: classification.type,
      isRecoverable: classification.isRecoverable,
      retryCount: error.config?._retryCount || 0,
    };

    // Always log the error for debugging
    console.error("Caught error:", errorDetails);

    // Only show toast for non-recoverable errors that should be shown
    if (classification.shouldShowToast) {
      toast.error(<ErrorToast error={errorDetails} />, {
        position: "top-center",
        autoClose: false,
        hideProgressBar: false,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      });
    } else if (classification.isRecoverable) {
      // Log recoverable errors silently
      console.log(
        `Recoverable error (${classification.type}): ${errorMessage}`,
      );
    }

    return classification;
  },

  /**
   * Classify an error without handling it
   * Useful for checking error type before deciding what to do
   */
  classifyError,

  /**
   * Error type constants
   */
  ErrorType,

  formatError: (error) => {
    if (typeof error === "string") {
      return error;
    } else if (error instanceof Error) {
      return JSON.stringify(
        {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        null,
        2,
      );
    } else {
      return JSON.stringify(error, null, 2);
    }
  },
};
