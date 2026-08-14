// App.jsx //

// Dependencies
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";
import { useEffect, useRef } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  AuthenticatedTemplate,
  UnauthenticatedTemplate,
  useMsal,
} from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { useRecoilValue } from "recoil";

// Components
import { Biddit2 } from "./pages/Biddit2.jsx";
import { Login } from "./pages/Login.jsx";
import ErrorBoundary from "./components/errorHandling/ErrorBoundary";
import StudyondBanner from "./components/common/StudyondBanner.jsx";
import AnalyticsNotice from "./components/common/AnalyticsNotice.jsx";
import { AppStateProvider } from "./components/common/AppStateProvider.jsx";
import { initAnalytics, trackPageView } from "./components/helpers/analytics";
import { selectedTabAtom } from "./components/recoil/selectedTabAtom";

/**
 * Pageview tracking plus GA4 startup. Init waits until MSAL has finished
 * processing the redirect, so the OAuth code fragment is stripped from the
 * URL before anything is reported.
 */
const Analytics = () => {
  const location = useLocation();
  const { inProgress } = useMsal();
  // Ref, not a dependency: the landing tab is read once at init time and
  // must not re-run the effect on every later tab switch.
  const currentTabRef = useRef(useRecoilValue(selectedTabAtom));

  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    if (inProgress === InteractionStatus.None) {
      initAnalytics({ initialView: currentTabRef.current });
    }
  }, [inProgress]);

  return null;
};

const App = () => {
  /**
   * Most applications will need to conditionally render certain components based on whether a user is signed in or not.
   * msal-react provides 2 easy ways to do this. AuthenticatedTemplate and UnauthenticatedTemplate components will
   * only render their children if a user is authenticated or unauthenticated, respectively. For more, visit:
   * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-react/docs/getting-started.md
   */
  return (
    <ErrorBoundary>
      <AppStateProvider>
        <div className="App">
          <BrowserRouter>
            <Analytics /> {/* Pageviews, events, MSAL-gated GA4 startup */}
            {/* Outside both templates: logged-out visitors see it too */}
            <AnalyticsNotice />
            <AuthenticatedTemplate>
              <StudyondBanner />
              <Routes>
                <Route
                  path="/"
                  element={
                    <ErrorBoundary>
                      <Biddit2 />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/biddit2"
                  element={
                    <ErrorBoundary>
                      <Biddit2 />
                    </ErrorBoundary>
                  }
                />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </AuthenticatedTemplate>
            <UnauthenticatedTemplate>
              <Routes>
                <Route
                  path="/login"
                  element={
                    <ErrorBoundary>
                      <Login />
                    </ErrorBoundary>
                  }
                />
                <Route path="*" element={<Navigate to="/login" />} />
              </Routes>
            </UnauthenticatedTemplate>
          </BrowserRouter>
          <ToastContainer />
        </div>
      </AppStateProvider>
    </ErrorBoundary>
  );
};

export default App;
