// Dependencies
import { useState, useRef, useEffect } from "react";
import "./collapsible.css";
import PropTypes from "prop-types";

// Component to selectively display details about the course
export default function Collapsible(props) {
  const [isOpen, setIsOpen] = useState(false);
  const parentRef = useRef();

  useEffect(() => {
    if (props.CloseOnToggle) {
      setIsOpen(false);
    }
  }, [props.CloseOnToggle]);

  return (
    <div className="md:pb-2 collapsible">
      <button
        className="text-sm font-medium toggle md:text-base"
        onClick={() => setIsOpen(!isOpen)}
      >
        {!isOpen ? (
          <div className="flex text-gray-900">
            {props.label}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="self-center w-3 h-3 "
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        ) : (
          <div className="flex text-gray-900">
            {props.label}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="self-center w-3 h-3 "
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        )}
      </button>
      <div
        className="text-xs content-parent md:text-sm"
        ref={parentRef}
        style={
          isOpen
            ? { height: parentRef.current.scrollHeight + "px" }
            : { height: "0px" }
        }
      >
        <div className="text-xs content md:text-sm">{props.children}</div>
      </div>
    </div>
  );
}
Collapsible.propTypes = {
  CloseOnToggle: PropTypes.bool,
  label: PropTypes.string.isRequired,
  children: PropTypes.node,
};

export { Collapsible };
