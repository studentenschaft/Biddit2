import { Suspense } from "react";
import shsg_logo_icon_title_white from "../../../assets/SHSG_Logo_Icon_Title_small_white.png";
import { ContactButton } from "./ContactButton";
import { PrivacyButton } from "./PrivacyButton";
import { AboutButton } from "./AboutButton";
import { LogoutButton } from "./LogoutButton";
import { ReviewButton } from "./ReviewButton";
import { StarIcon } from "@heroicons/react/outline";

// container holding logo and several buttons
export default function SideNav() {
  return (
    <div
      className="items-center justify-start p-3 mr-4 flex-col flex bg-hsg-800 h-full"
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
      <div className="flex flex-col">
        <Suspense
          fallback={
            <div className="inline-flex items-center justify-center p-2 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white active:bg-hsg-800 relative">
              <StarIcon className="block w-6 h-6" aria-hidden="true" />
            </div>
          }
        >
          <div className="py-1">
            <ReviewButton />{" "}
          </div>
        </Suspense>
        <div className="py-1">
          <AboutButton />
        </div>
        <div className="py-1">
          <PrivacyButton />
        </div>
        <div className="py-1">
          <ContactButton />
        </div>
        <div className="py-1">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}

export { SideNav };
