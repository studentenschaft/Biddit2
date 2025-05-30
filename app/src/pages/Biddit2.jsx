import { Suspense, useState } from "react";
import "react-tabs/style/react-tabs.css";
import { SelectSemester } from "../components/leftCol/topRow/SelectOptions";
import DevModeBanner from "../components/testing/DevModeBanner";
import { SideNav } from "../components/leftCol/sideNav/SideNav";

// Recoil
import { useRecoilState } from "recoil";
import { selectedTabAtom } from "../components/recoil/selectedTabAtom";

// Styles
import "./react-tabs.css";
import LoadingText from "../components/common/LoadingText";
import { InformationCircleIcon, XCircleIcon } from "@heroicons/react/solid";

// Tab & Contents
import { TabComponent } from "./TabComponent";

//mobile view
import { isLeftViewVisible } from "../components/recoil/isLeftViewVisible";

export default function Biddit2() {
  const [selectedTabState, setSelectedTabState] =
    useRecoilState(selectedTabAtom);
  const [isSideNavOpen, setIsSideNavOpen] = useState(false);
  // for mobile view
  const [isLeftViewVisibleState, setIsLeftViewVisibleState] =
    useRecoilState(isLeftViewVisible);

  return (
    <div className="flex flex-col md:flex-row w-full h-screen overflow-hidden ">
      {/* Mobile Menu Button */}
      <div className="md:hidden fixed bottom-10 left-0 z-50 p-4 ">
        <button
          onClick={() => setIsSideNavOpen(!isSideNavOpen)}
          className="p-2 rounded-md bg-white shadow-lg "
        >
          {!isSideNavOpen ? (
            <InformationCircleIcon className="h-6 w-6 text-green-700" />
          ) : (
            <XCircleIcon className="h-6 w-6 text-red-700" />
          )}
        </button>
      </div>

      {/* Side Navigation */}
      <div className={`md:block ${isSideNavOpen ? "block" : "hidden"}`}>
        <SideNav />
      </div>

      {/* Mobile View Toggle */}
      <div className="md:hidden fixed bottom-0 w-full bg-hsg-800 flex justify-around p-2 z-20 shadow-lg">
        <button
          onClick={() => setIsLeftViewVisibleState(true)}
          className={`flex-1 mx-1 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ease-in-out
              ${
                isLeftViewVisibleState
                  ? "bg-white text-hsg-800 shadow-sm"
                  : "bg-transparent text-white hover:bg-hsg-700"
              }`}
        >
          Course List
        </button>
        <button
          onClick={() => setIsLeftViewVisibleState(false)}
          className={`flex-1 mx-1 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ease-in-out
              ${
                !isLeftViewVisibleState
                  ? "bg-white text-hsg-800 shadow-sm"
                  : "bg-transparent text-white hover:bg-hsg-700"
              }`}
        >
          Tabs
        </button>
      </div>

      {/* Content */}
      <div
        className={`w-full h-full md:w-1/3 p-4 bg-gray-100 ${
          !isLeftViewVisibleState ? "hidden md:block" : ""
        }`}
      >
        <Suspense fallback={<LoadingText>Loading Course Data...</LoadingText>}>
          <SelectSemester />
        </Suspense>
      </div>
      <div
        className={`w-full h-full md:w-2/3 p-4 bg-white overflow-y-auto md:overflow-y-auto ${
          isLeftViewVisibleState ? "hidden md:block" : ""
        }`}
      >
        <Suspense
          fallback={<LoadingText>Loading dynamic Tab Text...</LoadingText>}
        >
          <TabComponent
            selectedTab={selectedTabState}
            onTabSelect={(index) => setSelectedTabState(index)}
          />
        </Suspense>
      </div>

      {/* DevModeBanner */}
      <DevModeBanner />
    </div>
  );
}

export { Biddit2 };
