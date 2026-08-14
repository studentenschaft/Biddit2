import { useRef, useState } from "react";
import PropTypes from "prop-types";
import { ShieldCheckIcon } from "@heroicons/react/outline";
import AppDialog from "../../common/AppDialog";

/**
 * Biddit's own privacy disclosure, shown in-app rather than linked out: the
 * SHSG policy does not cover Biddit's login, course data or analytics. The
 * Student Union's general policy is still reachable as the last section.
 *
 * The dialog is exported on its own so the first-visit AnalyticsNotice can
 * offer the same disclosure to logged-out visitors, who have no side bar.
 */
export function PrivacyDialog({ open, onClose }) {
  const closeButtonRef = useRef(null);

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Privacy"
      panelClassName="max-h-[70vh] overflow-y-auto"
      initialFocus={closeButtonRef}
    >
      <div className="text-left">
        <h4 className="mt-3 font-medium text-gray-900">Who we are</h4>
        <p className="mt-1 text-sm text-gray-500">
          Biddit is operated by the Student Union of the University of St.
          Gallen (SHSG). Questions and data requests:{" "}
          <a className="text-hsg-700 underline" href="mailto:biddit@shsg.ch">
            biddit@shsg.ch
          </a>
          .
        </p>

        <h4 className="mt-3 font-medium text-gray-900">
          Login &amp; course data
        </h4>
        <p className="mt-1 text-sm text-gray-500">
          You sign in with your HSG account via Microsoft Entra ID; login tokens
          are stored in your browser. Course information comes from University
          of St. Gallen APIs. When you use Biddit, requests to SHSG&apos;s
          server include your HSG login identity. Your wishlist and study plans
          are stored on SHSG servers in Switzerland.
        </p>

        <h4 className="mt-3 font-medium text-gray-900">
          Analytics (Google Analytics 4)
        </h4>
        <p className="mt-1 text-sm text-gray-500">
          We use Google Analytics to collect aggregate usage statistics (page
          views, tab switches, wishlist actions) to improve Biddit. Google sets
          cookies for this (<code>_ga</code>, valid about two years). Data may
          be transferred to Google LLC in the United
          States under the Swiss–U.S. Data Privacy Framework. You can opt out at
          any time via Analytics settings (the chart icon in this side bar);
          opting out takes effect immediately and is stored per browser.
        </p>

        <h4 className="mt-3 font-medium text-gray-900">Your rights</h4>
        <p className="mt-1 text-sm text-gray-500">
          Under the Swiss Federal Act on Data Protection (FADP) you can request
          access, correction, or deletion of your data:{" "}
          <a className="text-hsg-700 underline" href="mailto:biddit@shsg.ch">
            biddit@shsg.ch
          </a>
          . Complaints: the Federal Data Protection and Information Commissioner
          (FDPIC).
        </p>

        <h4 className="mt-3 font-medium text-gray-900">SHSG privacy policy</h4>
        <p className="mt-1 text-sm text-gray-500">
          The Student Union&apos;s general privacy policy is at{" "}
          <a
            className="text-hsg-700 underline"
            href="https://shsg.ch/privacy-policy"
            target="_blank"
            rel="noreferrer"
          >
            shsg.ch/privacy-policy
          </a>
          .
        </p>
      </div>

      <button
        type="button"
        ref={closeButtonRef}
        className="inline-flex justify-center w-full px-4 py-2 mt-6 text-white rounded-md shadow-sm bg-hsg-700 hover:bg-hsg-600 focus:outline-none focus:ring-2 focus:ring-hsg-600 focus:ring-offset-2 sm:w-auto"
        onClick={onClose}
      >
        Close
      </button>
    </AppDialog>
  );
}

PrivacyDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

/** Side-nav trigger (shield icon) for the privacy disclosure. */
export default function PrivacyButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-label="Privacy"
        className="inline-flex items-center justify-center p-2 text-white rounded-md hover:bg-hsg-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white active:bg-hsg-800"
        onClick={() => setOpen(true)}
      >
        <ShieldCheckIcon className="block w-6 h-6" aria-hidden="true" />
      </button>
      <PrivacyDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export { PrivacyButton };
