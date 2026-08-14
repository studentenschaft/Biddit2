import { Fragment } from "react";
import PropTypes from "prop-types";
import { Dialog, Transition } from "@headlessui/react";

/**
 * Shared modal shell for the side-nav dialogs (about, analytics, privacy).
 *
 * It owns the parts that must not drift apart: the portal, the z-[60] root and
 * the dimmed backdrop. Those layers are pinned by sideNavDialogStacking.test.jsx
 * — the dialog has to outrank every layer the Curriculum Map declares, and the
 * backdrop has to dim rather than only blur.
 */

/** Panel classes the dialogs share; per-dialog extras come via panelClassName. */
const PANEL_BASE_CLASS =
  "relative px-4 pt-5 pb-4 text-center transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:max-w-lg sm:w-full sm:p-6";

export default function AppDialog({
  open,
  onClose,
  title,
  children,
  panelClassName = "",
  initialFocus,
}) {
  if (!open) return null;

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-[60]"
        initialFocus={initialFocus}
        onClose={onClose}
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
              <Dialog.Panel className={`${PANEL_BASE_CLASS} ${panelClassName}`}>
                <div className="mt-3 sm:mt-5">
                  <Dialog.Title
                    as="h3"
                    className="m-4 text-lg font-medium leading-6 text-gray-900"
                  >
                    {title}
                  </Dialog.Title>
                </div>
                {children}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}

AppDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.node.isRequired,
  children: PropTypes.node,
  // Appended to the shared panel classes (e.g. a scroll cap).
  panelClassName: PropTypes.string,
  // Ref to focus when the dialog opens; usually the close button.
  initialFocus: PropTypes.shape({ current: PropTypes.any }),
};
