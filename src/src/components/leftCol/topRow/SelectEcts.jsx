import { useRecoilState, useRecoilValue } from "recoil";
import { ectsListSelector } from "../../recoil/ectsListSelector";
import { selectionOptionsState } from "../../recoil/selectionOptionsAtom";
import Select from "react-select";

export default function SelectEcts() {
  const ectsList = useRecoilValue(ectsListSelector);
  const [, setSelectedEctsAtom] = useRecoilState(selectionOptionsState);

  const handleSelect = (selectedOptions) => {
    const values = selectedOptions?.map((option) => Number(option.value)) || [];
    setSelectedEctsAtom((prev) => ({ ...prev, ects: values }));
  };

  const sortedEctsList = [...ectsList]
    .sort((a, b) => a - b)
    .map((ects) => ({ value: ects, label: (ects / 100).toFixed(2) }));

  return (
    <Select
      name="ects"
      id="ects"
      onChange={handleSelect}
      isMulti
      options={sortedEctsList}
      placeholder="ECTS"
    />
  );
}

export { SelectEcts };
