/**
 * ProgramSummaryRow.jsx
 *
 * Credits summary display showing earned and remaining ECTS.
 */

import PropTypes from 'prop-types';

const ProgramSummaryRow = ({ rawScorecard }) => {
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

ProgramSummaryRow.propTypes = {
  rawScorecard: PropTypes.shape({
    items: PropTypes.arrayOf(
      PropTypes.shape({
        maxCredits: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        sumOfCredits: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      })
    ),
  }),
};

export default ProgramSummaryRow;
