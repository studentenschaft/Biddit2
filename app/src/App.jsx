// App.jsx //

// Dependencies
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";
import { useEffect } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ReactGA from "react-ga4"; // Google Analytics 4 Library
import {
  AuthenticatedTemplate,
  UnauthenticatedTemplate,
} from "@azure/msal-react";

// Components
import { Biddit2 } from "./pages/Biddit2.jsx";
import { Login } from "./pages/Login.jsx";
import ErrorBoundary from "./components/errorHandling/ErrorBoundary";
import StudyondBanner from "./components/common/StudyondBanner.jsx";
import { AppStateProvider } from "./components/common/AppStateProvider.jsx";

// Initialize GA4 with Measurement ID and enable debug mode (for now)
const GA_MEASUREMENT_ID = "G-BMG2V9ZX73";
ReactGA.initialize(GA_MEASUREMENT_ID, { debug: true });

// Function to set user properties globally
const setUserProperties = () => {
  window.gtag("set", "user_properties", {
    app_version: "v2", //  custom property for tracking app version
  });
};

// Track Page Views
const TrackPageView = () => {
  const location = useLocation();

  useEffect(() => {
    ReactGA.send({ hitType: "pageview", page: location.pathname });
  }, [location]);

  return null;
};

const App = () => {
  /**
   * Most applications will need to conditionally render certain components based on whether a user is signed in or not.
   * msal-react provides 2 easy ways to do this. AuthenticatedTemplate and UnauthenticatedTemplate components will
   * only render their children if a user is authenticated or unauthenticated, respectively. For more, visit:
   * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-react/docs/getting-started.md
   */
  useEffect(() => {
    setUserProperties(); // Set user properties globally when app loads
  }, []);
  return (
    <ErrorBoundary>
      <AppStateProvider>
        <div className="App">
          <BrowserRouter>
            <TrackPageView /> {/* Tracks active users & page views */}
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
