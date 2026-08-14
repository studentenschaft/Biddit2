import { atom } from "recoil";
import { TAB } from "../../constants/tabs";

export const selectedTabAtom = atom({
  key: "selectedTab",
  default: TAB.SUMMARY,
});
