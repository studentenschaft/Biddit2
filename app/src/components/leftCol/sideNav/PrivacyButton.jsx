import { Fragment, useRef, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { ShieldCheckIcon } from "@heroicons/react/outline";

/**
 * Biddit's own privacy disclosure, shown in-app rather than linked out: the
 * SHSG policy does not cover Biddit's login, course data or analytics. The
 * Student Union's general policy is still reachable as the last section.
 *
 * Structure (portal, z-[60] root, dimmed backdrop) mirrors the other side-nav
 * dialogs and is pinned by sideNavDialogStacking.test.jsx.
 */
export default function PrivacyButton() {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef(null);

  return (
    <>
      <button
        aria-label="Privacy"
        className="inline-flex items-center justify-center p-2 text-white rounded-md hover:bg-hsg-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white active:bg-hsg-800"
        onClick={() => setOpen(true)}
      >
        <ShieldCheckIcon className="block w-6 h-6" aria-hidden="true" />
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
                  <Dialog.Panel className="relative max-h-[70vh] overflow-y-auto px-4 pt-5 pb-4 text-center transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                    <div className="mt-3 sm:mt-5">
                      <Dialog.Title
                        as="h3"
                        className="m-4 text-lg font-medium leading-6 text-gray-900"
                      >
                        Privacy
                      </Dialog.Title>
                      <div className="text-left">
                        <h4 className="mt-3 font-medium text-gray-900">
                          Who we are
                        </h4>
                        <p className="mt-1 text-sm text-gray-500">
                          Biddit is operated by the Student Union of the
                          University of St. Gallen (SHSG). Questions and data
                          requests:{" "}
                          <a
                            className="text-hsg-700 underline"
                            href="mailto:biddit@shsg.ch"
                          >
                            biddit@shsg.ch
                          </a>
                          .
                        </p>

                        <h4 className="mt-3 font-medium text-gray-900">
                          Login &amp; course data
                        </h4>
                        <p className="mt-1 text-sm text-gray-500">
                          You sign in with your HSG account via Microsoft Entra
                          ID; login tokens are stored in your browser. Course
                          information comes from University of St. Gallen APIs.
                          Your wishlist and study plans are stored
                          pseudonymously (keyed by a hashed identifier, not your
                          email) on SHSG servers in Switzerland.
                        </p>

                        <h4 className="mt-3 font-medium text-gray-900">
                          Analytics (Google Analytics 4)
                        </h4>
                        <p className="mt-1 text-sm text-gray-500">
                          We use Google Analytics to collect aggregate usage
                          statistics (page views, tab switches, wishlist
                          actions) to improve Biddit. Google sets the cookies{" "}
                          <code>_ga</code> and <code>_ga_BMG2V9ZX73</code>{" "}
                          (lifetime approx. 2 years). Data may be transferred to
                          Google LLC in the United States under the Swiss–U.S.
                          Data Privacy Framework. You can opt out at any time
                          via Analytics settings (the chart icon in this side
                          bar); opting out takes effect immediately and is
                          stored per browser.
                        </p>

                        <h4 className="mt-3 font-medium text-gray-900">
                          Your rights
                        </h4>
                        <p className="mt-1 text-sm text-gray-500">
                          Under the Swiss Federal Act on Data Protection (FADP)
                          you can request access, correction, or deletion of
                          your data:{" "}
                          <a
                            className="text-hsg-700 underline"
                            href="mailto:biddit@shsg.ch"
                          >
                            biddit@shsg.ch
                          </a>
                          . Complaints: the Federal Data Protection and
                          Information Commissioner (FDPIC).
                        </p>

                        <h4 className="mt-3 font-medium text-gray-900">
                          SHSG privacy policy
                        </h4>
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
                    </div>

                    <button
                      type="button"
                      ref={closeButtonRef}
                      className="inline-flex justify-center w-full px-4 py-2 mt-6 text-white rounded-md shadow-sm bg-hsg-700 hover:bg-hsg-600 focus:outline-none focus:ring-2 focus:ring-hsg-600 focus:ring-offset-2 sm:w-auto"
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

export { PrivacyButton };
