import { useState, useEffect } from "react";

import {
  IconSparkles,
  IconMessages,
  IconFiles,
  IconX,
} from "@tabler/icons-react";

const StudyondBanner = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const isDialogClosed = localStorage.getItem("studyondBannerClosed");
    if (isDialogClosed !== "true") {
      setTimeout(() => {
        setIsVisible(true);
        setTimeout(() => setIsAnimating(true), 200);
      }, 2000);
    }
  }, []);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      setIsVisible(false);
      localStorage.setItem("studyondBannerClosed", "true");
    }, 300);
  };

  const handleGetStarted = () => {
    window.open("https://app.studyond.com/login", "_blank");
  };

  if (!isVisible) return null;

  return (
    <div
      className={`fixed bottom-28 right-7 sm:bottom-16 sm:right-3 md:bottom-6 md:right-6 w-full max-w-sm bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden transition-all duration-500 ease-out ${
        isAnimating ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
      }`}
    >
      <div className="p-6 pt-7">
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 bg-white/80 backdrop-blur-sm rounded-full p-1.5 text-gray-600 hover:bg-white hover:text-gray-900 transition-all"
          aria-label="Close dialog"
        >
          <IconX className="h-4 w-4" />
        </button>
        <div className="mb-3">
          <h3 className="text-[27px] leading-[34px] font-semibold text-black mb-1.5">
            Looking for Thesis Topics or Interview Partners?
          </h3>
          <span className="text-sm text-gray-500 leading-relaxed">
            We partnered with{" "}
          </span>
          <a
            href="https://studyond.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-500 hover:text-black hover:cursor-pointer underline underline-offset-2"
          >
            Studyond{" "}
          </a>

          <span className="text-sm text-gray-500 leading-relaxed">
            to connect you with HSG supervisors and companies -{" "}
          </span>
          <span className="text-sm text-black font-bold leading-relaxed">
            for free!
          </span>
        </div>

        <div className="space-y-3 mb-6 py-1.5">
          <div className="flex items-start gap-3 max-w-xs pl-1">
            <div className="flex-shrink-0 mt-0.5">
              <div className="size-5 rounded-full flex items-center justify-center">
                <IconFiles className="size-5 text-black" />
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-700 leading-relaxed">
                <span className="font-bold text-black">
                  Explore 400+ Thesis Topics{" "}
                </span>
                <span className="font-normal text-gray-500">
                  from HSG professors and partner companies
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 max-w-xs pl-1">
            <div className="flex-shrink-0 mt-0.5">
              <div className="size-5 rounded-full flex items-center justify-center">
                <IconMessages stroke="2" className="size-5 text-black" />
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-700 leading-relaxed">
                <span className="font-bold text-black">
                  Find Interview Partners{" "}
                </span>

                <span className="text-sm font-normal text-gray-500">
                  and contacts for your thesis or course projects
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 max-w-xs pl-1">
            <div className="flex-shrink-0 mt-0.5">
              <div className="size-5 rounded-full flex items-center justify-center">
                <IconSparkles stroke="2" className="size-5 text-blue-700" />
              </div>
            </div>
            <div>
              <p className="text-sm leading-relaxed">
                <span className="font-bold bg-gradient-to-r from-purple-500 via-blue-700 to-blue-500 bg-clip-text text-transparent">
                  AI Topic Suggestions{" "}
                </span>

                <span className="text-sm font-normal text-gray-500">
                  to find the perfect topic or internship based on your profile
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 items-center">
          <button
            onClick={handleGetStarted}
            className="group flex-1 bg-black hover:bg-gray-950 text-white text-sm font-medium py-2.5 px-6 rounded-md transition-colors flex items-center justify-center gap-1"
          >
            <span>Login with HSG-Email</span>
            <span className="inline-block transition-transform duration-500 group-hover:translate-x-1">
              →
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudyondBanner;
