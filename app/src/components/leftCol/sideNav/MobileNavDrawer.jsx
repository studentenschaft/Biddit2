import { useEffect } from "react";
import PropTypes from "prop-types";
import { SideNav } from "./SideNav";

/**
 * The side nav as an overlay drawer, for phones only.
 *
 * Below md the side nav used to be an ordinary flex child of the app's
 * `flex-col` root, so opening it rendered a full-width green block *above* the
 * content and shoved the whole app down half a viewport. Overlaying it instead
 * leaves the layout underneath untouched, and the dimmed backdrop gives the
 * tap-outside-to-close every drawer is expected to have.
 *
 * Deliberately not a Headless UI Dialog, and deliberately without
 * role="dialog"/aria-modal: the drawer *contains* the Review and About
 * triggers, which each open a Headless UI Dialog of their own, and nesting
 * focus traps is a fight nobody wins. Claiming modal semantics without a focus
 * trap would just be a lie to screen readers, so it is a plain <nav> that
 * announces itself by name.
 *
 * Stacking, extending the ladder documented in ReviewButton.jsx: in-page fixed
 * elements sit at z-50 (AnalyticsNotice, StudyondBanner), CalendarEventSheet at
 * z-[55]/[56], the side-nav dialogs at z-[60], app-state blockers at z-[9999].
 * The drawer must cover the page but stay *under* the toggle that closes it and
 * under the dialogs it opens, so the backdrop takes z-[52] and the panel z-[53],
 * with the toggle in Biddit2.jsx lifted to z-[54] to stay on top of both.
 *
 * The band used to be z-[45]/[46], just under the z-50 toggle. The cookie
 * notice AnalyticsNotice arrived as another fixed z-50 element and painted
 * straight over the backdrop, so the whole drawer band moved above the z-50
 * layer rather than below it.
 */
export default function MobileNavDrawer({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    // md:hidden rather than a JS viewport check: with no focus trap involved,
    // a drawer that is merely invisible on desktop is harmless — and it can
    // only be opened by the md:hidden toggle in the first place.
    <div className="md:hidden">
      {/* A real button, not a div with onClick: tapping outside to close is a
          control, and it has to be reachable by keyboard and announced as one. */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="fixed inset-0 z-[52] w-full h-full bg-black/40"
      />
      <nav
        aria-label="App menu"
        className="fixed inset-y-0 left-0 z-[53] flex flex-col overflow-y-auto shadow-xl w-72 max-w-[80vw] bg-hsg-800"
      >
        <SideNav showLabels />
      </nav>
    </div>
  );
}

MobileNavDrawer.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
};

export { MobileNavDrawer };
