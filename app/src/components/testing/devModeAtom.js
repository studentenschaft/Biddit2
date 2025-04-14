import { atom } from "recoil";

const DEV_MODE_ENABLED = false; // Toggle this constant to enable/disable dev mode

// how to enable dev mode:
// set devModeState default to true in the atom
export const devModeState = atom({
  key: "devModeState",
  default: DEV_MODE_ENABLED,
});