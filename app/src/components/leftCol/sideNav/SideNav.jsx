import { Suspense } from "react";
import PropTypes from "prop-types";
import shsg_logo_icon_title_white from "../../../assets/SHSG_Logo_Icon_Title_small_white.png";
import { ContactButton } from "./ContactButton";
import { PrivacyButton } from "./PrivacyButton";
import { AboutButton } from "./AboutButton";
import { AnalyticsButton } from "./AnalyticsButton";
import { LogoutButton } from "./LogoutButton";
import { ReviewButton } from "./ReviewButton";
import { StarIcon } from "@heroicons/react/outline";
import { NAV_LABELS, navItemClassName } from "./navItem";

/**
 * Container holding the logo and the nav entries.
 *
 * Two variants, one item list: the desktop rail is icon-only (`showLabels`
 * false, the historical look), while the mobile drawer shows a visible label
 * beside each icon — six unexplained icons is not a menu a first-time user can
 * read. Keeping both variants here means an entry can never exist in one and
 * not the other.
 */
export default function SideNav({ showLabels = false }) {
  return (
    <div
      className={`justify-start p-3 flex-col flex bg-hsg-800 h-full ${
        showLabels ? "w-full items-stretch" : "items-center mr-4"
      }`}
      style={{ margin: "0" }}
    >
      <div className="flex flex-col mb-8">
        <a href="https://shsg.ch" target="_blank" rel="noreferrer">
          <img
            className="object-contain w-8 mt-2"
            src={shsg_logo_icon_title_white}
            alt="SHSG Logo"
          />
        </a>
      </div>
      <div className={`flex flex-col ${showLabels ? "w-full" : ""}`}>
        <Suspense
          fallback={
            <div className={navItemClassName(showLabels)}>
              <StarIcon className="block w-6 h-6 shrink-0" aria-hidden="true" />
              {showLabels && <span>{NAV_LABELS.review}</span>}
            </div>
          }
        >
          <div className="py-1">
            <ReviewButton showLabel={showLabels} />{" "}
          </div>
        </Suspense>
        <div className="py-1">
          <AboutButton showLabel={showLabels} />
        </div>
        <div className="py-1">
          <PrivacyButton showLabel={showLabels} />
        </div>
        <div className="py-1">
          <AnalyticsButton showLabel={showLabels} />
        </div>
        <div className="py-1">
          <ContactButton showLabel={showLabels} />
        </div>
        <div className="py-1">
          <LogoutButton showLabel={showLabels} />
        </div>
      </div>
    </div>
  );
}

SideNav.propTypes = {
  showLabels: PropTypes.bool,
};

export { SideNav };
