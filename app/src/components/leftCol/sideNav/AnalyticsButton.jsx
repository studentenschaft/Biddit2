import { Fragment, useRef, useState } from "react";
import { Dialog, Switch, Transition } from "@headlessui/react";
import { ChartBarIcon } from "@heroicons/react/outline";
import {
  isAnalyticsOptedOut,
  setAnalyticsOptOut,
} from "../../helpers/analytics";

/**
 * Side-nav entry point for the analytics consent setting — the "chart icon"
 * the first-visit AnalyticsNotice points at. Consent itself lives in
 * helpers/analytics.js; this is only its control surface.
 *
 * Structure (portal, z-[60] root, dimmed backdrop) mirrors the other side-nav
 * dialogs and is pinned by sideNavDialogStacking.test.jsx.
 */
export default function AnalyticsButton() {
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
        aria-label="Analytics settings"
        className="inline-flex items-center justify-center p-2 text-white rounded-md hover:bg-hsg-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white active:bg-hsg-800"
        onClick={openDialog}
      >
        <ChartBarIcon className="block w-6 h-6" aria-hidden="true" />
      </button>
      {open ? (
        <Transition.Root show={open} as={Fragment}>
          <Dialog
            as="div"
            // Same stacking ladder as ReviewButton — see the note there.
            className="relative z-[60]"
            initialFocus={closeButtonRef}
            onClose={setOpen}
          >
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              {/* Tinted, not blur-only — see the note in ReviewButton. */}
              <div className="fixed inset-0 transition-opacity bg-slate-900/60 backdrop-blur-sm" />
            </Transition.Child>

            <div className="fixed inset-0 z-10 overflow-y-auto">
              <div className="flex items-start justify-center min-h-full p-4 text-center sm:items-center sm:p-0">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                  enterTo="opacity-100 translate-y-0 sm:scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                  leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                >
                  <Dialog.Panel className="relative px-4 pt-5 pb-4 overflow-hidden text-center transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:max-w-lg sm:w-full sm:p-6">
                    <div className="mt-3 sm:mt-5">
                      <Dialog.Title
                        as="h3"
                        className="m-4 text-lg font-medium leading-6 text-gray-900"
                      >
                        Analytics
                      </Dialog.Title>
                      <div className="mt-2 space-y-2 text-left text-gray-500">
                        <p>
                          Biddit sends anonymous usage events to Google
                          Analytics — page views, tab switches and wishlist
                          actions. Your grades are never sent, and no identifier
                          beyond Google&apos;s own cookie.
                        </p>
                        <p>
                          Turning this off stops any further data from being
                          sent. Changes take effect immediately.
                        </p>
                        <p>
                          Full details: Privacy (shield icon) in the side bar.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 py-4 mt-4 border-t border-gray-200">
                      <span className="text-left text-gray-900">
                        Send anonymous usage data
                      </span>
                      <Switch
                        checked={analyticsEnabled}
                        onChange={handleToggle}
                        className={`${analyticsEnabled ? "bg-hsg-700" : "bg-gray-300"} relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-hsg-600`}
                      >
                        <span className="sr-only">Enable analytics</span>
                        <span
                          className={`${analyticsEnabled ? "translate-x-6" : "translate-x-1"} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                        />
                      </Switch>
                    </div>

                    <button
                      type="button"
                      ref={closeButtonRef}
                      className="inline-flex justify-center w-full px-4 py-2 text-white rounded-md shadow-sm bg-hsg-700 hover:bg-hsg-600 focus:outline-none focus:ring-2 focus:ring-hsg-600 focus:ring-offset-2 sm:w-auto"
                      onClick={() => setOpen(false)}
                    >
                      Close
                    </button>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition.Root>
      ) : null}
    </>
  );
}

export { AnalyticsButton };
