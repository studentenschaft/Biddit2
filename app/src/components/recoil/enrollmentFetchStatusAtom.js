import { atom, selector } from 'recoil';

export const enrollmentFetchStatusAtom = atom({
  key: "enrollmentFetchStatusAtom",
  default: {
    isLoading: true,
    hasError: false,
    isComplete: false
  }
});

export const enrollmentFetchStatusSelector = selector({
  key: "enrollmentFetchStatusSelector",
  get: ({get}) => get(enrollmentFetchStatusAtom)
});