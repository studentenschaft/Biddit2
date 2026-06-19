import PropTypes from "prop-types";

/**
 * Blocking modal overlay that appears when the user is offline.
 * Prompts user to check their connection and refresh the page.
 */
const OfflineModal = ({ isVisible, onRefresh }) => {
  if (!isVisible) return null;

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      window.location.reload();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-modal-title"
    >
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md mx-4 text-center">
        {/* Offline Icon */}
        <div className="mb-6">
          <svg
            className="w-20 h-20 mx-auto text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a5 5 0 01-1.414-7.072m0 0L9.172 5.757m-2.829 2.829a9 9 0 000 12.728M3 3l18 18"
            />
          </svg>
        </div>

        {/* Title */}
        <h2
          id="offline-modal-title"
          className="text-2xl font-bold text-gray-800 mb-3"
        >
          No Internet Connection
        </h2>

        {/* Message */}
        <p className="text-gray-600 mb-6">
          Please check your network connection and try again. Your work is safe
          and will continue once you&apos;re back online.
        </p>

        {/* Refresh Button */}
        <button
          onClick={handleRefresh}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Refresh Page
        </button>

        {/* Additional help text */}
        <p className="text-sm text-gray-500 mt-4">
          If the problem persists, try:
        </p>
        <ul className="text-sm text-gray-500 mt-2 text-left list-disc list-inside">
          <li>Checking your Wi-Fi or mobile data</li>
          <li>Restarting your router</li>
          <li>Disabling VPN if enabled</li>
        </ul>
      </div>
    </div>
  );
};

OfflineModal.propTypes = {
  isVisible: PropTypes.bool.isRequired,
  onRefresh: PropTypes.func,
};

export default OfflineModal;
