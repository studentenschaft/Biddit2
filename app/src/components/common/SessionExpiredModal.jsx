import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { clearSessionAndRedirect } from "../auth/tokenService";

/**
 * Blocking modal overlay that appears when the user's session has expired.
 * Shows a 3-second countdown before automatically redirecting to login.
 */
const SessionExpiredModal = ({ isVisible }) => {
  const [countdown, setCountdown] = useState(3);

  const handleRedirect = useCallback(() => {
    clearSessionAndRedirect();
  }, []);

  useEffect(() => {
    if (!isVisible) {
      setCountdown(3);
      return;
    }

    // Start countdown when modal becomes visible
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleRedirect();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isVisible, handleRedirect]);

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expired-modal-title"
    >
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md mx-4 text-center">
        {/* Session Expired Icon */}
        <div className="mb-6">
          <svg
            className="w-20 h-20 mx-auto text-orange-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        {/* Title */}
        <h2
          id="session-expired-modal-title"
          className="text-2xl font-bold text-gray-800 mb-3"
        >
          Session Expired
        </h2>

        {/* Message */}
        <p className="text-gray-600 mb-4">
          Your session has expired for security reasons. You will be redirected
          to the login page to sign in again.
        </p>

        {/* Countdown */}
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 text-orange-600">
            <span className="text-3xl font-bold">{countdown}</span>
          </div>
          <p className="text-sm text-gray-500 mt-2">Redirecting to login...</p>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
          <div
            className="bg-orange-500 h-2 rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${((3 - countdown) / 3) * 100}%` }}
          />
        </div>

        {/* Manual redirect button */}
        <button
          onClick={handleRedirect}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Go to Login Now
        </button>
      </div>
    </div>
  );
};

SessionExpiredModal.propTypes = {
  isVisible: PropTypes.bool.isRequired,
};

export default SessionExpiredModal;
