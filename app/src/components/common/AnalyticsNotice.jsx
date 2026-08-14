/**
 * AnalyticsNotice.jsx
 *
 * First-visit disclosure that Biddit reports usage to GA4, with a one-click
 * opt-out. Mounted outside both auth templates so logged-out visitors on
 * /login see it too, hence a fixed-bottom card rather than the inline
 * IaChangeNotice slot. Shown only where analytics actually runs (production
 * host) — the claim would be untrue on dev and preview builds.
 * Dismissal is remembered in localStorage, matching IaChangeNotice.
 */

import { useState } from "react";
import PropTypes from "prop-types";
import { InformationCircleIcon, XIcon } from "@heroicons/react/outline";
import {
  isAnalyticsEnvironment,
  isAnalyticsOptedOut,
  setAnalyticsOptOut,
} from "../helpers/analytics";

export const ANALYTICS_NOTICE_STORAGE_KEY =
  "biddit-analytics-notice-dismissed-v1";

export default function AnalyticsNotice({
  analyticsActive = isAnalyticsEnvironment(),
}) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(ANALYTICS_NOTICE_STORAGE_KEY) === "true",
  );

  if (!analyticsActive || dismissed || isAnalyticsOptedOut()) return null;

  const dismiss = () => {
    localStorage.setItem(ANALYTICS_NOTICE_STORAGE_KEY, "true");
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex items-start gap-2.5 rounded-md border border-blue-200 bg-blue-50 p-3 shadow-lg sm:left-auto sm:max-w-md">
      <InformationCircleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
      <div className="flex-1 text-sm text-blue-800">
        <p>
          Biddit uses Google Analytics to understand how the app is used. You
          can opt out at any time via the chart icon in the side bar. Details
          under the shield icon (Privacy).
        </p>
        <button
          type="button"
          className="mt-2 font-medium underline"
          onClick={() => {
            setAnalyticsOptOut(true);
            dismiss();
          }}
        >
          Opt out of analytics
        </button>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="text-blue-500 hover:text-blue-800"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

AnalyticsNotice.propTypes = {
  // Injectable for tests; defaults to the production-host check.
  analyticsActive: PropTypes.bool,
};
