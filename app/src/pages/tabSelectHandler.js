import { tabIdAt } from "../constants/tabs";

/**
 * Builds the react-tabs onSelect handler: converts the index back to a tab id
 * and stores it. Extracted from Biddit2 so the conversion can be tested without
 * mounting the MSAL-dependent page. The `tab_select` event is emitted by the
 * selectedTabAtom effect, so re-selecting the active tab stays a no-op here.
 */
export function makeTabSelectHandler(currentTabId, setSelectedTabState) {
  return (index) => {
    const nextTabId = tabIdAt(index);
    if (nextTabId === currentTabId) return;
    setSelectedTabState(nextTabId);
  };
}
