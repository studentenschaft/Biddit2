import PropTypes from 'prop-types';
import { errorHandlingService } from './ErrorHandlingService';

const ErrorCodeBlock = ({ error }) => {
    const errorString = errorHandlingService.formatError(error);
    
    return (
      <div className="mt-2 p-2 rounded max-h-40">
        <pre className="text-xs text-700 overflow-auto h-full whitespace-pre-wrap">
          {errorString}
        </pre>
      </div>
    );
  };
  
  ErrorCodeBlock.propTypes = {
    error: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
  };
  
  export default ErrorCodeBlock;