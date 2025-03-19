import React from 'react';

export const ScorecardErrorMessage = () => (
  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-4">
    <div className="flex">
      <div className="ml-3">
        <h3 className="text-sm font-medium text-yellow-800">
          Scorecard Data Unavailable
        </h3>
        <p className="text-sm text-yellow-700 mt-2">
          We couldn't load your scorecard data at this time. You can continue using Biddit's other features while we resolve this issue.
        </p>
      </div>
    </div>
  </div>
);