// ErrorBoundary.jsx

import React from 'react';
import PropTypes from 'prop-types';
import { errorHandlingService } from './ErrorHandlingService';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    errorHandlingService.handleError(error);
  }

  handleReset() {
    this.setState({ hasError: false });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback 
        ? React.cloneElement(this.props.fallback, { onReset: this.handleReset }) 
        : (
          <div>
            <h3>Something went wrong. Please try refreshing the component.</h3>
            <button onClick={this.handleReset}>Retry</button>
          </div>
        );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  fallback: PropTypes.node,
  children: PropTypes.node.isRequired,
};

export default ErrorBoundary;