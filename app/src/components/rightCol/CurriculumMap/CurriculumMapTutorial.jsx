/**
 * CurriculumMapTutorial.jsx
 *
 * First-time tutorial overlay for the Curriculum Map.
 * Shows a centered modal explaining the four key interactions.
 * Controlled by parent — receives isOpen/onDismiss props.
 */

import { Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import PropTypes from "prop-types";

const TUTORIAL_ITEMS = [
  {
    label: "Drag courses from the list",
    description: "Drag any course from the left panel onto a grid cell to plan it. (Courses you saved will already show up here!)",
  },
  {
    label: "Click a cell to add a placeholder",
    description: "Click any empty area in a semester row to create a placeholder course.",
  },
  {
    label: "Drag to rearrange",
    description: "Move planned courses between semesters and categories by dragging.",
  },
];

const LEGEND_ITEMS = [
  { color: "bg-green-600", label: "Completed" },
  { color: "bg-green-200 border border-green-300", label: "Enrolled" },
  { color: "bg-gray-200 border border-gray-300", label: "Planned" },
];

const CurriculumMapTutorial = ({ isOpen, onDismiss }) => {
  if (!isOpen) return null;

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={onDismiss}
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
          <div className="fixed inset-0 bg-black/30 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="relative w-full max-w-md transform rounded-xl bg-white p-6 shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-semibold text-gray-900 mb-1"
                >
                  Welcome to the Curriculum Map
                </Dialog.Title>
                <Dialog.Description className="text-sm text-gray-500 mb-5">
                  Here&apos;s how to plan your studies:
                </Dialog.Description>

                <div className="space-y-4">
                  {TUTORIAL_ITEMS.map((item) => (
                    <div key={item.label} className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-hsg-50 text-hsg-700">
                        <span className="text-xs font-bold">
                          {TUTORIAL_ITEMS.indexOf(item) + 1}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {item.label}
                        </p>
                        <p className="text-sm text-gray-500">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Color legend */}
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-hsg-50 text-hsg-700">
                      <span className="text-xs font-bold">4</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 mb-1.5">
                        Color legend
                      </p>
                      <div className="flex gap-3">
                        {LEGEND_ITEMS.map((item) => (
                          <div
                            key={item.label}
                            className="flex items-center text-xs text-gray-600"
                          >
                            <div
                              className={`h-3 w-3 rounded mr-1.5 ${item.color}`}
                            />
                            {item.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onDismiss}
                  className="mt-6 w-full rounded-lg bg-hsg-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-hsg-700 focus:outline-none focus:ring-2 focus:ring-hsg-500 focus:ring-offset-2 transition-colors"
                >
                  Got it
                </button>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

CurriculumMapTutorial.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onDismiss: PropTypes.func.isRequired,
};

export const TUTORIAL_STORAGE_KEY = "curriculumMapTutorialSeen";
export default CurriculumMapTutorial;
