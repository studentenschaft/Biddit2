import { createContext, useContext } from "react";
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

export const useCurriculumPlanContext = () => {
  const ctx = useContext(CurriculumPlanContext);
  if (!ctx) {
    throw new Error("useCurriculumPlanContext must be used within CurriculumPlanProvider");
  }
  return ctx;
};
