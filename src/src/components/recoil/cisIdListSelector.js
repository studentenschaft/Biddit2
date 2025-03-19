import { selector } from "recoil";
import { cisIdList } from "./cisIdListAtom";
import { latestValidTermProjectionState } from "./latestValidTermProjection";
//TODO: FIX async issue: this is updated several times before values are correct but wrong values are already displayed without beening refecthed
export const cisIdListSelector = selector({
  key: "cisIdListSelector",
  get: async ({ get }) => {
    const latestValidTermProjection = get(latestValidTermProjectionState);
    const result = [];
    const search = get(cisIdList);

    if (search && search.length > 0) {
      const filtered = search.filter(
        (item) => item.shortName && item.timeSegmentId && item.id
      );

      // Add the most recent 3 semesters by default
      filtered.slice(0, 3).forEach((item, index) => {
        result.push({
          index: index + 1,
          shortName: item.shortName,
          id: item.timeSegmentId,
          cisId: item.id,
          isCurrent: item.isCurrent,
          isProjected: false, // flag to allow filtering of pure data.
        });
      });

      // If latestValidTermProjection exists, find matching shortName
      if (latestValidTermProjection) {
        const matchIndex = filtered.findIndex(
          (item) => item.shortName === latestValidTermProjection
        );

        if (matchIndex !== -1) {
          for (let i = 0; i < 2; i++) {
            // Start loop at 0 to handle two entries
            const nextEntry = filtered[matchIndex + i];
            if (nextEntry) {
              const modifiedShortName = nextEntry.shortName.replace(
                /(\d{2})$/,
                (match) => (parseInt(match) + 1).toString()
              );
              result.push({
                index: result.length + 1,
                shortName: modifiedShortName,
                id: nextEntry.timeSegmentId,
                cisId: nextEntry.id,
                isCurrent: nextEntry.isCurrent,
                isProjected: true, // flag to allow filtering of pure data.
              });
            }
          }
        }
      }
    }
    return result;
  },
});
