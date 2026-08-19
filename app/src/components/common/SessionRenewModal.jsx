import { useMemo } from "react";
import PropTypes from "prop-types";
import { clearSessionAndRedirect } from "../auth/tokenService";
import SendErrorButton from "../errorHandling/SendErrorButton";

// sessionStorage key used to remember that we already prompted a refresh in
// this tab. If a renewable session error recurs shortly after a refresh, we
// escalate to the log-out / report step instead of asking to refresh again.
const RENEW_ATTEMPT_KEY = "biddit.sessionRenewAttemptedAt";
// How long a prior refresh attempt is considered "recent" (ms).
const RECURRENCE_WINDOW_MS = 2 * 60 * 1000;

/**
 * Returns true if a refresh was already attempted recently in this tab.
 */
const hasRecentRefreshAttempt = () => {
  try {
    const ts = Number(sessionStorage.getItem(RENEW_ATTEMPT_KEY));
    return Boolean(ts) && Date.now() - ts < RECURRENCE_WINDOW_MS;
  } catch {
    return false;
  }
};

/**
 * Blocking modal for a transient/renewable session problem.
 *
 * Step 1 (first occurrence): prompt the user to refresh the page (F5) — a full
 * reload re-initialises MSAL and usually recovers a session that the silent,
 * in-iframe refresh could not.
 * Step 2 (recurs after a refresh): escalate to logging out + back in, and only
 * then offer to report the issue.
 */
const SessionRenewModal = ({ isVisible }) => {
  // Computed once per mount; the page reloads between step 1 and step 2 anyway.
  const isRecurrence = useMemo(() => hasRecentRefreshAttempt(), []);

  if (!isVisible) return null;

  const handleRefresh = () => {
    try {
      sessionStorage.setItem(RENEW_ATTEMPT_KEY, String(Date.now()));
    } catch {
      // ignore storage failures; we still attempt the reload
    }
    window.location.reload();
  };

  const handleReLogin = () => {
    try {
      sessionStorage.removeItem(RENEW_ATTEMPT_KEY);
    } catch {
      // ignore
    }
    clearSessionAndRedirect();
  };

  // Minimal error payload for the report button (shaped to SendErrorButton).
  const reportError = {
    id: "session-renew",
    message: "Session could not be renewed after a page refresh",
    statusCode: 401,
    timestamp: new Date().toISOString(),
    url: window.location.href,
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-renew-modal-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden">
        {/* Icon header */}
        <div className="flex justify-center pt-8 pb-2">
          <span className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-hsg-50">
            {/* Refresh icon */}
            <svg
              className="h-10 w-10 text-hsg-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h5M20 20v-5h-5"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9a8 8 0 0 0-14.5-2.5L4 9m0 6a8 8 0 0 0 14.5 2.5L20 15"
              />
            </svg>
          </span>
        </div>

        <div className="px-8 pb-8 pt-2 text-center">
          {!isRecurrence ? (
            <>
              <h2
                id="session-renew-modal-title"
                className="text-xl font-semibold text-slate-800"
              >
                Let&apos;s refresh your session
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Your session needs a quick refresh. Reload the page to continue
                — your work is safe.
              </p>

              <button
                onClick={handleRefresh}
                className="mt-6 w-full rounded-xl bg-hsg-600 px-6 py-3 font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-hsg-700 focus:outline-none focus:ring-2 focus:ring-hsg-500 focus:ring-offset-2"
              >
                Refresh page
              </button>

              <button
                onClick={handleReLogin}
                className="mt-3 w-full rounded-xl px-6 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700"
              >
                Or log out and back in
              </button>
            </>
          ) : (
            <>
              <h2
                id="session-renew-modal-title"
                className="text-xl font-semibold text-slate-800"
              >
                Still having trouble?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                A refresh didn&apos;t fix your session. Logging out and back in
                usually resolves it.
              </p>

              <button
                onClick={handleReLogin}
                className="mt-6 w-full rounded-xl bg-hsg-600 px-6 py-3 font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-hsg-700 focus:outline-none focus:ring-2 focus:ring-hsg-500 focus:ring-offset-2"
              >
                Log out and back in
              </button>

              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-400">
                  If this keeps happening, let us know:
                </p>
                <SendErrorButton
                  error={reportError}
                  buttonColor="bg-slate-500"
                  buttonHoverColor="bg-slate-600"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

SessionRenewModal.propTypes = {
  isVisible: PropTypes.bool.isRequired,
};

export default SessionRenewModal;
