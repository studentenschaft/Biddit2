// SendErrorButton.jsx //

import PropTypes from "prop-types";
import { toast } from "react-toastify";
import { formatErrorDetails } from "./formatErrorDetails";

const SendErrorButton = ({ error, buttonColor, buttonHoverColor }) => {
  const handleSendError = () => {
    const recipient = "biddit@shsg.ch";
    const subject = encodeURIComponent(
      `Error Report from Biddit - ${window.location.hostname}`
    );

    // Construct the email body using the utility function
    const bodyContent = `
An error occurred in the Biddit application:

${formatErrorDetails(error)}
    `;

    const body = encodeURIComponent(bodyContent);

    const mailtoLink = `mailto:${recipient}?subject=${subject}&body=${body}`;

    // Attempt to open the email client
    try {
      window.location.href = mailtoLink;
    } catch (error) {
      console.error("Failed to open email client:", error);
      toast.error(
        "Failed to open your email client. Please send an email to biddit@shsg.ch with the error details."
      );
    }
  };

  return (
    <button
      onClick={handleSendError}
      className={`mt-2 px-4 py-2 rounded ${buttonColor} hover:${buttonHoverColor} text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
    >
      Send Error
    </button>
  );
};

SendErrorButton.propTypes = {
  error: PropTypes.shape({
    id: PropTypes.string.isRequired,
    message: PropTypes.string.isRequired,
    statusCode: PropTypes.number,
    timestamp: PropTypes.string.isRequired,
    url: PropTypes.string,
    method: PropTypes.string,
    headers: PropTypes.object,
    params: PropTypes.object,
    data: PropTypes.object,
    user: PropTypes.object,
    stack: PropTypes.string,
  }).isRequired,
  buttonColor: PropTypes.string,
  buttonHoverColor: PropTypes.string,
};

SendErrorButton.defaultProps = {
  buttonColor: "bg-blue-600",
  buttonHoverColor: "bg-blue-700",
};

export default SendErrorButton;
