import { useEffect, useRef, useState } from "react";
import { IconX } from "@tabler/icons-react";
import { useDegradedMode } from "./useDegradedMode";

const DEFAULT_MESSAGE =
  "Some features are temporarily reduced due to high demand. Course browsing, calendar and transcript remain available — we'll be back soon.";

// CSS custom property that page layouts read (via
// `var(--degraded-banner-height, 0px)`) to reserve space below the fixed
// banner instead of letting it overlay app content. Keeping the banner
// `fixed` (rather than moving it into normal document flow) means this is
// the only coupling point between the banner and page layouts.
const HEIGHT_CSS_VAR = "--degraded-banner-height";

/**
 * Fixed-top, non-blocking banner shown while degraded mode is active (see
 * `helpers/degradedModeService.js`). The close button collapses the banner
 * for this page load only (plain component state, no localStorage) — it
 * reappears on reload as long as the flag is still on.
 *
 * Because the banner is fixed-positioned (so it stays visible while
 * scrolling), it doesn't push content down on its own. It measures its own
 * height and publishes it as `--degraded-banner-height` on the document root
 * so page layouts can offset themselves below it — keeping the tab bar and
 * the rest of the app clickable without dismissing the banner.
 */
const DegradedModeBanner = () => {
  const { isDegradedMode, message } = useDegradedMode();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const bannerRef = useRef(null);
  const isVisible = isDegradedMode && !isCollapsed;

  useEffect(() => {
    const root = document.documentElement;

    if (!isVisible) {
      root.style.setProperty(HEIGHT_CSS_VAR, "0px");
      return;
    }

    const node = bannerRef.current;
    if (!node) return;

    const updateHeight = () => {
      root.style.setProperty(HEIGHT_CSS_VAR, `${node.offsetHeight}px`);
    };
    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);

    return () => {
      observer.disconnect();
      root.style.setProperty(HEIGHT_CSS_VAR, "0px");
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div
      ref={bannerRef}
      className="fixed top-0 left-0 right-0 z-50 bg-hsg-700 text-white shadow-md"
    >
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
