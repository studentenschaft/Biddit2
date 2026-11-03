import { useCallback } from "react";
import { atom, useSetRecoilState } from "recoil";

// The study plan holds every semester, so it is fetched once per session.
// `loaded` is set once a fetch has been applied; bumping `version` forces a
// refetch (e.g. after a failed wishlist write left local state out of sync).
export const studyPlanLoadState = atom({
  key: "studyPlanLoadState",
  default: { loaded: false, version: 0 },
});

export const useInvalidateStudyPlan = () => {
  const setLoadState = useSetRecoilState(studyPlanLoadState);
  return useCallback(
    () =>
      setLoadState((prev) => ({ loaded: false, version: prev.version + 1 })),
    [setLoadState]
  );
};
