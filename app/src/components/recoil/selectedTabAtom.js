import { atom, DefaultValue } from "recoil";
import { TAB } from "../../constants/tabs";
import { trackTabSelect } from "../helpers/analytics";

const DEFAULT_TAB = TAB.SUMMARY;

// Emitting from the atom (rather than from each caller) makes every tab change
// reportable, no matter which component triggered it.
const tabTelemetryEffect = ({ onSet }) => {
  onSet((newValue, oldValue) => {
    const previousTab =
      oldValue instanceof DefaultValue ? DEFAULT_TAB : oldValue;
    if (newValue === previousTab) return;
    trackTabSelect(newValue, previousTab);
  });
};

export const selectedTabAtom = atom({
  key: "selectedTab",
  default: DEFAULT_TAB,
  effects: [tabTelemetryEffect],
});
