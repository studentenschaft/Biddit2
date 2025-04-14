import { useRecoilState } from "recoil";
import { customGradesState } from "../recoil/customGradesAtom";
import { useRecoilValue } from "recoil";
import { authTokenState } from "../recoil/authAtom";
import {
  fetchCustomGrades,
  updateCustomGrade as apiUpdateCustomGrade,
  deleteCustomGrade as apiDeleteCustomGrade,
} from "../recoil/ApiCustomGrades";
import { useEffect, useCallback, useRef } from "react";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";

export function useCustomGrades() {
  const [customGrades, setCustomGrades] = useRecoilState(customGradesState);
  const authToken = useRecoilValue(authTokenState);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    const loadCustomGrades = async () => {
      if (!initialLoadDone.current) {
        const grades = await fetchCustomGrades(authToken);
        setCustomGrades(grades);
        initialLoadDone.current = true;
      }
    };
    loadCustomGrades();
  }, [authToken, setCustomGrades]);

  const updateGrade = useCallback(
    async (courseIdentifier, grade) => {
      try {
        if (grade === null) {
          if (!customGrades[courseIdentifier]) {
            throw new Error(
              `Grade for course ${courseIdentifier} does not exist.`
            );
          }
          await apiDeleteCustomGrade(authToken, courseIdentifier);
        } else {
          await apiUpdateCustomGrade(authToken, courseIdentifier, grade);
        }
        setCustomGrades((prevGrades) => ({
          ...prevGrades,
          [courseIdentifier]: grade,
        }));
      } catch (error) {
        if (error.message.includes("does not exist")) {
          console.error("Error deleting grade:", error);
        } else {
          console.error("Error updating grade:", error);
        }
        if (!error.message.includes("does not exist")) {
          errorHandlingService.handleError(error);
        }
      }
    },
    [authToken, customGrades, setCustomGrades]
  );

  const getCustomGrade = useCallback(
    (courseIdentifier) => {
      return customGrades[courseIdentifier] || null;
    },
    [customGrades]
  );

  return {
    customGrades,
    updateCustomGrade: updateGrade,
    getCustomGrade,
  };
}
