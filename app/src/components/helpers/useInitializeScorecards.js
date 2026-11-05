import { useEffect, useRef } from "react";
import { useRecoilValue } from "recoil";
import { authTokenState } from "../recoil/authAtom";
import { useScorecardFetching } from "./useScorecardFetching";

/**
 * Bootstraps scorecard data once an auth token is available. Delegates to
 * useScorecardFetching().fetchAll, the single scorecard bootstrap path.
 */
export const useInitializeScoreCards = (handleError) => {
  const authToken = useRecoilValue(authTokenState);
  const { fetchAll, isLoaded, loading } = useScorecardFetching();
  // One attempt per mount: a failure is retried when the consumer mounts
  // again, never in a loop within the same mount.
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current || !authToken || isLoaded || loading) return;
    attempted.current = true;
    fetchAll(authToken).catch(handleError);
  }, [authToken, isLoaded, loading, fetchAll, handleError]);
};
