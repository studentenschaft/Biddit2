// ErrorToast.jsx //

import ErrorCodeBlock from './ErrorCodeBlock';
import SendErrorButton from './SendErrorButton';
import PropTypes from 'prop-types';
import { toast } from 'react-toastify';

const ErrorToast = ({ error }) => {
    const errorMessage = error.message || 'An unexpected error occurred';
    //const errorId = error.id || 'N/A';

    return (
      <div className="flex flex-col w-full">
        <h3 className="text-lg font-medium text-800">Oops...</h3>
        <p className="mt-2 text-sm text-700">
          Whoops, you found a bug. There seems to be an error with this feature:
          <br />
          <span className="italic text-red-400">{errorMessage}</span>
        </p>
        <div className="error-details mt-3 bg-gray-100 p-2 rounded">
          <h4 className="text-sm font-semibold text-800 mb-1">Error Details:</h4>
          <ErrorCodeBlock error={error} />
        </div>
        <p className="error-message mt-3 text-xs text-700">
          Please send us an email by clicking the <span className="font-bold">Send Error</span> button or copy the error message above and send us an email at <span className="font-bold">biddit@shsg.ch</span> so we can fix the issue for you and others.
        </p>
        <div className="mt-4 flex justify-between items-center">
          <SendErrorButton
            error={error}
            buttonColor="bg-hsg-600"
            buttonHoverColor="bg-hsg-700"
          />
          <button 
            onClick={() => toast.dismiss()}
            className="px-3 py-2 text-sm font-medium text-700 hover:text-900 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

ErrorToast.propTypes = {
  error: PropTypes.oneOfType([PropTypes.object, PropTypes.string]).isRequired,
};

export default ErrorToast;