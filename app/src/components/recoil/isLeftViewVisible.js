import { atom, DefaultValue } from "recoil";
import { trackColumnSwitch } from "../helpers/analytics";

// Atom to store the visibility of the left view in mobile view

const DEFAULT_VISIBLE = false;

// Emitting from the atom keeps the column switch reportable regardless of which
// control (nav button, swipe, deep link) flipped it.
const columnTelemetryEffect = ({ onSet }) => {
  onSet((newValue, oldValue) => {
    const wasVisible =
      oldValue instanceof DefaultValue ? DEFAULT_VISIBLE : oldValue;
    if (newValue === wasVisible) return;
    trackColumnSwitch(newValue);
  });
};

export const isLeftViewVisible = atom({
  key: "isLeftViewVisible",
  default: DEFAULT_VISIBLE,
  effects: [columnTelemetryEffect],
});
