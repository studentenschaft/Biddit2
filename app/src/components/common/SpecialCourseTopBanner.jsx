import { useState, useEffect } from "react";
import { IconX } from "@tabler/icons-react";

// ── Banner Configuration ─────────────────────────────────────────────
// Flip ENABLED to true and update BANNER_CONFIG to activate a new announcement.
// Change storageKey each time to reset previous dismissals.
const ENABLED = false;

const BANNER_CONFIG = {
  storageKey: "specialBanner_example_2025",
  title: "Announcement Title",
  message: "Description of the announcement goes here.",
  linkUrl: "", // leave empty to hide the link
  linkText: "Learn more →",
};
// ─────────────────────────────────────────────────────────────────────

const SpecialCourseTopBanner = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!ENABLED) return;
    if (localStorage.getItem(BANNER_CONFIG.storageKey) === "true") return;
    const showTimer = setTimeout(() => {
      setIsVisible(true);
      setTimeout(() => setIsAnimating(true), 50);
    }, 1000);
    return () => clearTimeout(showTimer);
  }, []);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      setIsVisible(false);
      localStorage.setItem(BANNER_CONFIG.storageKey, "true");
    }, 300);
  };

  if (!ENABLED || !isVisible) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 bg-hsg-700 text-white shadow-md transition-transform duration-300 ease-out ${
        isAnimating ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <p className="text-sm font-medium sm:text-base">
          <span className="mr-2 font-semibold">{BANNER_CONFIG.title}</span>
          <span>— {BANNER_CONFIG.message}</span>
          {BANNER_CONFIG.linkUrl && (
            <a
              href={BANNER_CONFIG.linkUrl}
              className="ml-2 inline-block underline underline-offset-2 hover:text-hsg-100"
            >
              {BANNER_CONFIG.linkText}
            </a>
          )}
        </p>
        <button
          onClick={handleClose}
          className="ml-4 flex-shrink-0 rounded-full p-1 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          aria-label="Close banner"
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default SpecialCourseTopBanner;
