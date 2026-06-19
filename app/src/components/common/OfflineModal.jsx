import PropTypes from "prop-types";

/**
 * Blocking modal overlay that appears when the user is offline.
 * Prompts the user to check their connection and try again.
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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-modal-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden">
        {/* Icon header */}
        <div className="flex justify-center pt-8 pb-2">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-slate-200 opacity-60" />
            <span className="relative inline-flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
              {/* Wi-Fi off icon */}
              <svg
                className="h-10 w-10 text-slate-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <line x1="3" y1="3" x2="21" y2="21" strokeLinecap="round" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.5 16.5a5 5 0 0 1 6.16-.72"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 12.55a11 11 0 0 1 5.2-2.78M18.7 10.1a11 11 0 0 1 1.3.9"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M1.6 9.1a16 16 0 0 1 4.2-2.6M22.4 9.1a16 16 0 0 0-6.9-3.2"
                />
                <line
                  x1="12"
                  y1="20"
                  x2="12.01"
                  y2="20"
                  strokeLinecap="round"
                  strokeWidth={2.5}
                />
              </svg>
            </span>
          </div>
        </div>

        <div className="px-8 pb-8 pt-2 text-center">
          {/* Title */}
          <h2
            id="offline-modal-title"
            className="text-xl font-semibold text-slate-800"
          >
            You appear to be offline
          </h2>

          {/* Message */}
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Make sure you have a steady connection and try again. Your work is
            safe and will continue once you&apos;re back online.
          </p>

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            className="mt-6 w-full rounded-xl bg-hsg-600 px-6 py-3 font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-hsg-700 focus:outline-none focus:ring-2 focus:ring-hsg-500 focus:ring-offset-2"
          >
            Try again
          </button>

          {/* Help text */}
          <p className="mt-5 text-xs font-medium uppercase tracking-wide text-slate-400">
            Still not working?
          </p>
          <ul className="mt-2 space-y-1 text-left text-sm text-slate-500">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
              Check your Wi-Fi or mobile data
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
              Restart your router
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
              Disable your VPN if one is enabled
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

OfflineModal.propTypes = {
  isVisible: PropTypes.bool.isRequired,
  onRefresh: PropTypes.func,
};

export default OfflineModal;
