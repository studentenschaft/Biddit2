import { useRecoilState } from "recoil";
import { selectionOptionsState } from "../../recoil/selectionOptionsAtom";
import Select from "react-select";

const SelectRatings = () => {
  const ratingList = [1, 2, 3, 4];
  const [, setSelectedRatingAtom] = useRecoilState(selectionOptionsState);

  const handleSelect = (selectedOption) => {
    const value = selectedOption ? selectedOption.value : null;
    setSelectedRatingAtom((prev) => ({
      ...prev,
      ratings: value ? [Number(value)] : [],
    }));
  };

  return (
    <Select
      name="rating"
      id="rating"
      onChange={handleSelect}
      placeholder="Ratings"
      options={ratingList.map((rating) => ({
        value: rating,
        label: `>${rating}`,
      }))}
      isClearable
    />
  );
};

export { SelectRatings };
