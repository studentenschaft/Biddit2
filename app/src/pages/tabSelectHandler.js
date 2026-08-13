import ReactGA from "react-ga4";
import { tabIdAt } from "../constants/tabs";

/**
 * Builds the react-tabs onSelect handler: converts the index back to a tab id,
 * reports the transition to GA4 and stores the new id. Extracted from Biddit2
 * so the telemetry can be tested without mounting the MSAL-dependent page.
 */
export function makeTabSelectHandler(currentTabId, setSelectedTabState) {
  return (index) => {
    const nextTabId = tabIdAt(index);
    if (nextTabId === currentTabId) return;
    ReactGA.event("tab_select", { from: currentTabId, to: nextTabId });
    setSelectedTabState(nextTabId);
  };
}
