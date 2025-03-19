import { useState } from "react";
import { useRecoilState } from "recoil";
import { selectionOptionsState } from "../../recoil/selectionOptionsAtom";

const SearchTerm = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [, setSelectionOptions] = useRecoilState(selectionOptionsState);

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setSelectionOptions((prev) => ({
      ...prev,
      searchTerm: value,
    }));
  };

  const handleFocus = () => {
    setSearchTerm("");
    setSelectionOptions((prev) => ({
      ...prev,
      searchTerm: "",
    }));
  };

  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg
          className="h-5 w-5 text-gray-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.35-4.35"
          />
        </svg>
      </div>
      <input
        type="text"
        name="courseSearch"
        id="courseSearch"
        className="block w-full pl-10 border-gray-300 rounded-md shadow-sm focus:border-hsg-600 focus:ring-hsg-600 sm:text-sm"
        placeholder="Search"
        value={searchTerm}
        onChange={handleSearch}
        onFocus={handleFocus}
        style={{ marginBottom: "10px" }}
      />
    </div>
  );
};

export { SearchTerm };
