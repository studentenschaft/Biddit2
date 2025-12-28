/**
 * @deprecated This file is unused and scheduled for removal.
 * Functionality migrated to unified state management system.
 * Last checked: December 2024
 */

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