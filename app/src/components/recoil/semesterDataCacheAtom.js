/**
 * @deprecated This file is unused and scheduled for removal.
 * Functionality migrated to unified state management system.
 * Last checked: December 2024
 */

import { atom } from 'recoil';

export const semesterDataCacheState = atom({
  key: 'semesterDataCacheState',
  default: {
    cache: {},
    timestamps: {}
  }
});