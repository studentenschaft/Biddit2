import { useState, useEffect } from "react";
import { IconX } from "@tabler/icons-react";

const STORAGE_KEY = "specialCourseTopBannerClosed";

const SpecialCourseTopBanner = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "true") return;
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
      localStorage.setItem(STORAGE_KEY, "true");
    }, 300);
  };

  if (!isVisible) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 bg-hsg-700 text-white shadow-md transition-transform duration-300 ease-out ${
        isAnimating ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <p className="text-sm font-medium sm:text-base">
          <span className="mr-2 font-semibold">Special Master Course Announcement</span>
          <span className="hidden sm:inline">
            — "Das ethische Unternehmen?" (Kontextstudium Master) will appear in Bidding Round 3 due to a technical issue. Don't
  miss it!
          </span>
          <a
            href="https://courses.unisg.ch/event/events/by-term/bcfa3ae5-e57c-4b67-b89c-92e887a85405/15167775"
            className="ml-2 inline-block underline underline-offset-2 hover:text-hsg-100"
          >
            Learn more →
          </a>
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
