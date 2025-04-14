import { atom } from 'recoil';

export const semesterDataCacheState = atom({
  key: 'semesterDataCacheState',
  default: {
    cache: {},
    timestamps: {}
  }
});