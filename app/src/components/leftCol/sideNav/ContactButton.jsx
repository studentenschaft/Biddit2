import PropTypes from "prop-types";
import { MailIcon } from "@heroicons/react/outline";
import { NAV_LABELS, navItemClassName } from "./navItem";

// Mailto link. The <a> carries the styling itself so the whole row — icon and
// label alike — is the tap target.
export default function ContactButton({ showLabel = false }) {
  return (
    <a
      href="mailto:biddit@shsg.ch"
      aria-label={showLabel ? undefined : NAV_LABELS.contact}
      className={navItemClassName(showLabel)}
    >
      <MailIcon className="block w-6 h-6 shrink-0" aria-hidden="true" />
      {showLabel && <span>{NAV_LABELS.contact}</span>}
    </a>
  );
}

ContactButton.propTypes = {
  showLabel: PropTypes.bool,
};

export { ContactButton };
