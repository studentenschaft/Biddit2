import { useEffect } from "react";
import { useRecoilValue } from "recoil";
import { authTokenState } from "../recoil/authAtom";
import { useScorecardFetching } from "./useScorecardFetching";

/**
 * Bootstraps scorecard data once an auth token is available. Delegates to
 * useScorecardFetching().fetchAll, the single scorecard bootstrap path.
 */
export const useInitializeScoreCards = (handleError) => {
  const authToken = useRecoilValue(authTokenState);
  const { fetchAll, isLoaded, loading, error } = useScorecardFetching();

  // A failed attempt is not retried from here (that would loop); consumers
  // offer an explicit retry, e.g. CurriculumMap's "Try again".
  useEffect(() => {
    if (!authToken || isLoaded || loading || error) return;
    fetchAll(authToken).catch(handleError);
  }, [authToken, isLoaded, loading, error, fetchAll, handleError]);
};
