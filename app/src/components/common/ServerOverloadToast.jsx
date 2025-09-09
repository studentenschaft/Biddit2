import PropTypes from 'prop-types';

const ServerOverloadToast = ({ onDismiss }) => (
  <div className="flex flex-col w-full">
    <h3 className="text-lg font-medium text-orange-800 flex items-center">
      <svg className="w-5 h-5 mr-2 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      Server Overload
    </h3>
    <p className="mt-2 text-sm text-gray-700">
      Our backend server (api.shsg.ch) is currently experiencing high load.
    </p>
    <div className="mt-3 p-3 bg-orange-50 rounded-md border border-orange-200">
      <p className="text-sm text-orange-800">
        <strong>Temporarily Disabled:</strong>
      </p>
      <ul className="mt-1 text-sm text-orange-700 list-disc list-inside">
        <li>Find Similar Courses feature</li>
        <li>Smart Search feature</li>
      </ul>
    </div>
    <p className="mt-3 text-xs text-gray-600">
      These features will be restored once server load returns to normal. 
      You can still browse courses and view all other features.
    </p>
    <div className="mt-4 flex justify-end">
      <button 
        onClick={onDismiss}
        className="px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-md transition-colors"
      >
        Understood
      </button>
    </div>
  </div>
);

ServerOverloadToast.propTypes = {
  onDismiss: PropTypes.func,
};

export default ServerOverloadToast;