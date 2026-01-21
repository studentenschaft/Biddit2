import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../components/auth/authConfig";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

import SHSGLogo from "../assets/SHSG_Logo_Circle_100x100mm_RGB_green.png";

/**
 * Renders the Login page component.
 *
 * @returns {JSX.Element} The rendered Login page.
 */
export default function Login() {
  const { instance } = useMsal();

  const handleLoginRedirect = () => {
    instance
      .loginRedirect({
        ...loginRequest,
        prompt: "login",
      })
      .catch((e) => console.log(e));
  };

  const navigate = useNavigate();
  useEffect(() => {
    const account = instance.getActiveAccount();
    if (account) {
      navigate("/biddit2", { replace: true });
    }
  }, [instance, navigate]);
  const [showCookieBanner, setShowCookieBanner] = useState(true);
  const handleCookieBanner = () => {
    setShowCookieBanner(false);
  };

  return (
    <>
      <div id="root">
        <div className="bg-gray-100">
          <div className="relative h-screen overflow-hidden">
            <div className="flex h-full">
              <div>
                <div className="w-screen h-screen backdrop-filter backdrop-blur-sm">
                  <div className="absolute transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow w-7/8 top-1/2 lg:w-1/3 left-1/2 lg:top-1/3">
                    <div className="p-4 sm:p-6 text-center">
                      <img
                        alt="SHSG Logo"
                        src={SHSGLogo}
                        className="w-36 h-36 md:w-48 md:h-48 mx-auto mb-8"
                      />
                      <h3 className="text-lg font-medium leading-6 text-center text-gray-900">
                        Welcome to Biddit by{" "}
                        <a
                          href="https://shsg.ch"
                          target="_blank"
                          rel="noreferrer"
                          className="text-hsg-700"
                        >
                          SHSG
                        </a>
                        .
                      </h3>
                      <div className="pt-1 text-xs text-gray-500">
                        <p>For students, by students.</p>
                      </div>
                      <div className="flex justify-center mt-5">
                        <button
                          type="button"
                          className="inline-flex items-center px-6 py-3 text-base font-medium text-white border border-transparent rounded-md shadow-sm bg-hsg-600 hover:bg-hsg-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-hsg-500"
                          onClick={handleLoginRedirect}
                        >
                          Login
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="w-5 h-5 ml-3 -mr-1"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            ></path>
                          </svg>
                        </button>
                      </div>
                      <div className="mt-5 text-xs text-gray-500">
                        Disclaimer: Only information provided directly by HSG is
                        legally binding.
                      </div>
                      <a
                        href="https://courses.unisg.ch"
                        className="text-xs text-hsg-700"
                      >
                        HSG Courses
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {showCookieBanner && (
              <div className="fixed bottom-0 w-full flex pb-2 sm:pb-5 z-50 block">
                <div className="p-2 bg-white rounded-lg shadow-lg sm:p-3 mx-auto text-xs">
                  <div className="flex flex-wrap items-center justify-between">
                    <div className="flex items-center flex-1">
                      <p className="ml-3 font-medium text-gray-500 mr-4">
                        <span className="">
                          We use cookies for the HSG login, as well as Google
                          Analytics.

                        </span>
                      </p>
                      <a
                        href="https://shsg.ch/privacy-policy"
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-hsg-600 hover:text-hsg-500 mr-4"
                      >
                        SHSG Privacy Notice
                        <span aria-hidden="true"> →</span>
                      </a>
                    </div>
                    <div className="flex-shrink-0 order-2 sm:order-3 sm:ml-2">
                      <button
                        type="button"
                        className="flex -mr-1 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-white"
                        onClick={handleCookieBanner}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          className="w-6 h-6 text-gray-500"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M6 18L18 6M6 6l12 12"
                          ></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export { Login };
