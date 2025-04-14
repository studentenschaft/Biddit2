import { atom } from "recoil";

export const authTokenState = atom({
  key: "authTokenState", // unique ID (with respect to other atoms/selectors)
  default: null, // default value (aka initial value)
});
