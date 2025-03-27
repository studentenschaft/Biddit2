import { useRecoilState, useRecoilValue } from "recoil";
import { languageListSelector } from "../../recoil/languageListSelector";
import { selectionOptionsState } from "../../recoil/selectionOptionsAtom";
import Select from "react-select";

export default function SelectLanguage() {
  const languageList = useRecoilValue(languageListSelector);
  const [, setSelectedLanguageAtom] = useRecoilState(selectionOptionsState);

  const handleSelect = (selectedOption) => {
    setSelectedLanguageAtom((prev) => ({
      ...prev,
      courseLanguage: selectedOption ? [selectedOption.value] : [],
    }));
  };

  return (
    <Select
      name="language"
      id="language"
      onChange={handleSelect}
      options={languageList.map((language) => ({
        value: language,
        label: language,
      }))}
      placeholder="Language"
      isClearable
    />
  );
}

export { SelectLanguage };
