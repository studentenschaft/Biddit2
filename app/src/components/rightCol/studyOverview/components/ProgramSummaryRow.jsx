/**
 * ProgramSummaryRow.jsx
 *
 * Credits summary display showing earned and remaining ECTS.
 */

import React from 'react';

const ProgramSummaryRow = ({ program, rawScorecard }) => {
  const programTotalRequired = rawScorecard?.items?.[0]?.maxCredits
    ? parseFloat(rawScorecard.items[0].maxCredits)
    : 0;
  const programEarned = rawScorecard?.items?.[0]?.sumOfCredits
    ? parseFloat(rawScorecard.items[0].sumOfCredits)
    : 0;
  const programRemaining = Math.max(0, programTotalRequired - programEarned);

  return (
    <div className="p-2 flex flex-col items-end text-right">
      <div className="font-semibold">
        Earned ECTS:{" "}
        <span className="text-black-800">
          {programEarned.toFixed(2)} / {programTotalRequired.toFixed(2)}
        </span>
      </div>
      <div className="font-semibold">
        Remaining ECTS:{" "}
        <span className="text-black-800">{programRemaining.toFixed(2)}</span>
      </div>
    </div>
  );
};

export default ProgramSummaryRow;
