import { createContext, useContext } from "react";
import PropTypes from "prop-types";
import { useCurriculumPlan } from "../../helpers/useCurriculumPlan";

const CurriculumPlanContext = createContext(null);

export const CurriculumPlanProvider = ({ children }) => {
  const value = useCurriculumPlan();
  return (
    <CurriculumPlanContext.Provider value={value}>
      {children}
    </CurriculumPlanContext.Provider>
  );
};

CurriculumPlanProvider.propTypes = {
  children: PropTypes.node,
};

// The provider and its consumer hook belong together; splitting them would only
// move the import churn elsewhere for a dev-only fast-refresh nicety.
// eslint-disable-next-line react-refresh/only-export-components
export const useCurriculumPlanContext = () => {
  const ctx = useContext(CurriculumPlanContext);
  if (!ctx) {
    throw new Error("useCurriculumPlanContext must be used within CurriculumPlanProvider");
  }
  return ctx;
};
