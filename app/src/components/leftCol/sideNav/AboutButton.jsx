import { useState, useRef } from "react";
import PropTypes from "prop-types";
import { InformationCircleIcon } from "@heroicons/react/outline";
import AppDialog from "../../common/AppDialog";
import { NAV_LABELS, navItemClassName } from "./navItem";

// Button for AboutModal
export default function AboutButton({ showLabel = false }) {
  const [open, setOpen] = useState(false);

  function updateCookie() {
    const o = localStorage.getItem("aboutus") === "true" ? true : true;
    localStorage.setItem("aboutus", !o);
    setOpen(!open);
  }
  const cancelButtonRef = useRef(null);
  return (
    <>
      <button
        // The visible label is the accessible name in label mode; both come
        // from NAV_LABELS so they cannot disagree.
        aria-label={showLabel ? undefined : NAV_LABELS.about}
        className={navItemClassName(showLabel)}
        onClick={() => updateCookie()}
      >
        <InformationCircleIcon
          className="block w-6 h-6 shrink-0"
          aria-hidden="true"
        />
        {showLabel && <span>{NAV_LABELS.about}</span>}
      </button>
      <AppDialog
        open={open}
        onClose={setOpen}
        title="Biddit V2: A New Chapter Begins 🚀"
        initialFocus={cancelButtonRef}
      >
        <div className="mt-2 text-gray-500 text-md">
          <p>
            Biddit has a new team, and this version introduces a major overhaul.
            We hope it brings even greater benefits to us students. A heartfelt
            thank you to the founding fathers,{" "}
            <a
              className="text-hsg-700"
              href="https://www.linkedin.com/in/marc-robin-gruener/"
              target="_blank"
              rel="noreferrer"
            >
              Marc
            </a>{" "}
            &{" "}
            <a
              className="text-hsg-700"
              href="https://www.linkedin.com/in/michabrugger/"
              target="_blank"
              rel="noreferrer"
            >
              Micha
            </a>
            , for their ingenuity that sparked the creation of Biddit and for
            trusting SHSG and present students with the opportunity to maintain
            and further develop it. We are also deeply grateful for the
            overwhelming support Biddit has received from students and the
            administration alike.
          </p>

          <br />
          <p>
            Biddit thrives on your use, feedback, and ideas. So please don’t
            hesitate to share your thoughts or any issues you encounter! Your
            input is invaluable and remains our greatest asset in improving this
            beloved tool that saves us all during every bidding phase.
          </p>

          <p className="mt-2">💚 The Biddit Team:</p>
        </div>
        <div className="w-full pt-4 text-center text-md">
          <a
            className="text-hsg-700"
            href="https://www.linkedin.com/in/marc-bl%C3%B6chlinger/"
            target="_blank"
            rel="noreferrer"
          >
            Marc
          </a>{" "}
          &{" "}
          <a
            className="text-hsg-700"
            href="https://www.linkedin.com/in/gian-andri-hofmann-94a45624b/"
            target="_blank"
            rel="noreferrer"
          >
            Gian
          </a>{" "}
          (Current Devs),{" "}
          <a
            className="text-hsg-700"
            href="https://www.linkedin.com/in/ida-luisa-matter-954b9a299/"
            target="_blank"
            rel="noreferrer"
          >
            Ida
          </a>{" "}
          (SHSG IT)
        </div>
      </AppDialog>
    </>
  );
}

AboutButton.propTypes = {
  showLabel: PropTypes.bool,
};

export { AboutButton };
