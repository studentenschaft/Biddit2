import { useRef, useState } from "react";
import PropTypes from "prop-types";
import { Switch } from "@headlessui/react";
import { ChartBarIcon } from "@heroicons/react/outline";
import AppDialog from "../../common/AppDialog";
import { NAV_LABELS, navItemClassName } from "./navItem";
import {
  isAnalyticsOptedOut,
  setAnalyticsOptOut,
} from "../../helpers/analytics";

/**
 * Side-nav entry point for the analytics consent setting — the "chart icon"
 * the first-visit AnalyticsNotice points at. Consent itself lives in
 * helpers/analytics.js; this is only its control surface.
 */
export default function AnalyticsButton({ showLabel = false }) {
  const [open, setOpen] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(
    () => !isAnalyticsOptedOut(),
  );
  const closeButtonRef = useRef(null);

  const handleToggle = (checked) => {
    setAnalyticsOptOut(!checked);
    setAnalyticsEnabled(checked);
  };

  // Consent can also change from the first-visit notice while this stays
  // mounted, so the switch re-reads the stored value each time it opens.
  const openDialog = () => {
    setAnalyticsEnabled(!isAnalyticsOptedOut());
    setOpen(true);
  };

  return (
    <>
      <button
        // The visible label is the accessible name in label mode; both come
        // from NAV_LABELS so they cannot disagree.
        aria-label={showLabel ? undefined : NAV_LABELS.analytics}
        className={navItemClassName(showLabel)}
        onClick={openDialog}
      >
        <ChartBarIcon className="block w-6 h-6 shrink-0" aria-hidden="true" />
        {showLabel && <span>{NAV_LABELS.analytics}</span>}
      </button>
      <AppDialog
        open={open}
        onClose={setOpen}
        title="Analytics"
        initialFocus={closeButtonRef}
      >
        <div className="mt-2 space-y-2 text-left text-gray-500">
          <p>
            Biddit collects anonymous usage events — page views, tab switches,
            wishlist actions — via Google Analytics.
          </p>
          <p>
            Turning this off stops any further data from being sent. Changes
            take effect immediately.
          </p>
          <p>Full details: Privacy (shield icon) in the side bar.</p>
        </div>

        {/* Switch.Group so the visible label is the switch's own label and
            clicking it toggles — WCAG 2.5.3 label-in-name. */}
        <Switch.Group>
          <div className="flex items-center justify-between gap-4 py-4 mt-4 border-t border-gray-200">
            <Switch.Label className="text-left text-gray-900 cursor-pointer">
              Send anonymous usage data
            </Switch.Label>
            <Switch
              checked={analyticsEnabled}
              onChange={handleToggle}
              className={`${analyticsEnabled ? "bg-hsg-700" : "bg-gray-300"} relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-hsg-600`}
            >
              <span
                className={`${analyticsEnabled ? "translate-x-6" : "translate-x-1"} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
              />
            </Switch>
          </div>
        </Switch.Group>

        <button
          type="button"
          ref={closeButtonRef}
          className="inline-flex justify-center w-full px-4 py-2 text-white rounded-md shadow-sm bg-hsg-700 hover:bg-hsg-600 focus:outline-none focus:ring-2 focus:ring-hsg-600 focus:ring-offset-2 sm:w-auto"
          onClick={() => setOpen(false)}
        >
          Close
        </button>
      </AppDialog>
    </>
  );
}

AnalyticsButton.propTypes = {
  showLabel: PropTypes.bool,
};

export { AnalyticsButton };
