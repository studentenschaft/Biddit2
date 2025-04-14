import { useRecoilValue, useRecoilState } from "recoil";

import { classificationsListSelector } from "../../recoil/classificationsListSelector";
import { selectionOptionsState } from "../../recoil/selectionOptionsAtom";

import Select from "react-select";

export default function SelectClassification() {
  const classificationNames = useRecoilValue(classificationsListSelector);

  const [, setSelectedClassificationAtom] = useRecoilState(
    selectionOptionsState
  );

  const handleSelect = (e) => {
    setSelectedClassificationAtom((prev) => ({
      ...prev,
      classifications: e.target.value,
    }));
  };

  return (
    <Select
      name="classification"
      id="classification"
      onChange={(selectedOptions) =>
        handleSelect({
          target: {
            value: selectedOptions
              ? selectedOptions.map((option) => option.value)
              : [],
          },
        })
      }
      isClearable
      isMulti
      options={classificationNames.map((classification) => ({
        value: classification,
        label: classification,
      }))}
      placeholder="Classification(s)"
    />
  );
}

export { SelectClassification };
