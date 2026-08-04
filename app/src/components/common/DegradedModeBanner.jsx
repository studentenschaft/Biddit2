import { useState } from "react";
import { IconX } from "@tabler/icons-react";
import { useDegradedMode } from "./useDegradedMode";

const DEFAULT_MESSAGE =
  "Some features are temporarily reduced due to high demand. Course browsing, calendar and transcript remain available — we'll be back soon.";

/**
 * Fixed-top, non-blocking banner shown while degraded mode is active (see
 * `helpers/degradedModeService.js`). The close button collapses the banner
 * for this page load only (plain component state, no localStorage) — it
 * reappears on reload as long as the flag is still on.
 */
const DegradedModeBanner = () => {
  const { isDegradedMode, message } = useDegradedMode();
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!isDegradedMode || isCollapsed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-hsg-700 text-white shadow-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <p className="text-sm font-medium sm:text-base">
          {message || DEFAULT_MESSAGE}
        </p>
        <button
          onClick={() => setIsCollapsed(true)}
          className="ml-4 flex-shrink-0 rounded-full p-1 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          aria-label="Close banner"
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default DegradedModeBanner;
