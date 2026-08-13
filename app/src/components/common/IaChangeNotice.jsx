/**
 * IaChangeNotice.jsx
 *
 * One-time banner explaining the tab restructuring: Smart Search moved into the
 * course list, and the remaining tabs are grouped by scope. It must not claim
 * Study Overview is gone — that tab is retained (see ADR 0002) and carries its
 * own migration notice.
 * Dismissal is remembered in localStorage, matching CurriculumMapBetaNotice.
 */

import { useState } from "react";
import { InformationCircleIcon, XIcon } from "@heroicons/react/outline";

export const IA_NOTICE_STORAGE_KEY = "biddit-ia-notice-dismissed-v1";

export default function IaChangeNotice() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(IA_NOTICE_STORAGE_KEY) === "true",
  );

  if (dismissed) return null;

  return (
    <div className="mx-1 mt-2 flex items-start gap-2.5 rounded-md border border-blue-200 bg-blue-50 p-3">
      <InformationCircleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
      <p className="flex-1 text-sm text-blue-800">
        We tidied up: Smart Search now lives in the course list on the left
        (toggle Keyword / Smart), and the tabs are grouped by scope — This
        Semester and My Degree.
      </p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          localStorage.setItem(IA_NOTICE_STORAGE_KEY, "true");
          setDismissed(true);
        }}
        className="text-blue-500 hover:text-blue-800"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
