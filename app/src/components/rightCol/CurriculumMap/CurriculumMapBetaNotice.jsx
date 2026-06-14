/**
 * CurriculumMapBetaNotice.jsx
 *
 * One-time welcome callout shown at the top of the Curriculum Map while the
 * feature is in Beta. It onboards first-time users and invites feedback, then
 * dismisses for good. Dismissal is remembered in localStorage, matching the
 * pattern used by SpecialCourseTopBanner.
 */

import { useState, useEffect } from "react";
import { InformationCircleIcon, XIcon } from "@heroicons/react/outline";

const STORAGE_KEY = "curriculumMapBetaNoticeDismissed";
const FEEDBACK_URL = "mailto:biddit@shsg.ch?subject=Curriculum%20Map%20feedback";

const CurriculumMapBetaNotice = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) !== "true") {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  if (!isVisible) return null;

  return (
    <div className="flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 p-3">
      <InformationCircleIcon className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" />
      <div className="flex-1 text-sm">
        <p className="font-semibold text-amber-800">
          Welcome to the new Curriculum Map (Beta)
        </p>
        <p className="text-amber-700 mt-0.5">
          Plan your whole degree at a glance. Some features may still change —{" "}
          <a
            href={FEEDBACK_URL}
            className="font-medium underline decoration-amber-400 underline-offset-2 hover:text-amber-900"
          >
            tell us what you think →
          </a>
        </p>
      </div>
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 text-amber-500 hover:text-amber-800 transition-colors"
        aria-label="Dismiss Beta notice"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
};

export default CurriculumMapBetaNotice;
