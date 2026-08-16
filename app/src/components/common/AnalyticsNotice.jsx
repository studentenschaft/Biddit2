/**
 * First-visit disclosure of the login cookies and GA4, with a one-click opt-out
 * and the full privacy text. Shown only where analytics actually runs (the
 * production host) — the claim would be untrue on dev and preview builds.
 */

import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { InformationCircleIcon, XIcon } from "@heroicons/react/outline";
import { PrivacyDialog } from "../leftCol/sideNav/PrivacyButton";
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
  const [privacyOpen, setPrivacyOpen] = useState(false);

  // Opting out elsewhere (side bar, another tab) also settles the disclosure,
  // so record it — otherwise the notice would reappear on a later opt-in.
  const settledByOptOut =
    analyticsActive && !dismissed && isAnalyticsOptedOut();
  useEffect(() => {
    if (settledByOptOut) {
      localStorage.setItem(ANALYTICS_NOTICE_STORAGE_KEY, "true");
    }
  }, [settledByOptOut]);

  if (!analyticsActive || dismissed || isAnalyticsOptedOut()) return null;

  const dismiss = () => {
    localStorage.setItem(ANALYTICS_NOTICE_STORAGE_KEY, "true");
    setDismissed(true);
  };

  return (
    // The fixed element is a positioning wrapper only, and takes no pointer
    // events: on a phone it stretches the full width (left-4 right-4), and at
    // sm+ `justify-end` parks the card in the corner while the wrapper still
    // spans the row. Anything it caught outside the blue card is a tap meant
    // for the course list behind it — the notice's hit area has to be exactly
    // the box it paints, which is what pointer-events-auto on the card gives.
    //
    // bottom-28 on mobile clears the side-nav toggle (fixed bottom-10 + p-4,
    // 72px tall) and the bottom tab bar beneath it; both are md:hidden. It
    // cannot go lower: the toggle draws at z-50 over this notice and would
    // land on the opt-out and privacy links in the card's bottom-left corner.
    <div className="pointer-events-none fixed bottom-28 left-4 right-4 z-50 flex justify-end md:bottom-4">
      <div
        role="status"
        className="pointer-events-auto flex w-full items-start gap-2.5 rounded-md border border-blue-200 bg-blue-50 p-3 shadow-lg sm:max-w-md"
      >
        <InformationCircleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
        <div className="flex-1 text-sm text-blue-800">
          <p>
            Biddit uses cookies for the HSG login and Google Analytics for
            anonymous usage statistics. Analytics is optional — you can opt out
            now, or at any time later via Analytics settings (chart icon) in the
            side bar after signing in.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            <button
              type="button"
              className="font-medium underline"
              onClick={() => {
                setAnalyticsOptOut(true);
                dismiss();
              }}
            >
              Opt out of analytics
            </button>
            <button
              type="button"
              className="font-medium underline"
              onClick={() => setPrivacyOpen(true)}
            >
              Privacy details
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismiss}
          className="text-blue-500 hover:text-blue-800"
        >
          <XIcon className="h-4 w-4" />
        </button>
        <PrivacyDialog
          open={privacyOpen}
          onClose={() => setPrivacyOpen(false)}
        />
      </div>
    </div>
  );
}

AnalyticsNotice.propTypes = {
  // Injectable for tests; defaults to the production-host check.
  analyticsActive: PropTypes.bool,
};
