import { useRecoilState, useRecoilValue } from "recoil";
import { lecturersListSelector } from "../../recoil/lecturersListSelector";
import { selectionOptionsState } from "../../recoil/selectionOptionsAtom";
import Select from "react-select";

export default function SelectLecturer() {
  const lecturerList = useRecoilValue(lecturersListSelector);
  const [, setSelectedLecturerAtom] = useRecoilState(selectionOptionsState);

  const handleSelect = (e) => {
    const value = e.target.value;
    setSelectedLecturerAtom((prev) => ({
      ...prev,
      lecturer: value,
    }));
  };

  return (
    <Select
      name="select lecturers"
      id="lecturers"
      isSearchable
      isMulti
      placeholder="Lecturer(s)"
      options={lecturerList.map((lecturer) => ({
        value: lecturer,
        label: lecturer,
      }))}
      onChange={(selectedOptions) =>
        handleSelect({
          target: {
            value: selectedOptions.map((option) => option.value),
          },
        })
      }
    />
  );
}

export { SelectLecturer };
