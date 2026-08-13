import { useEffect, useRef, useState } from "react";
import { useRecoilState, useRecoilValue } from "recoil";
import { selectionOptionsState } from "../../recoil/selectionOptionsAtom";
import { smartSearchState } from "../../recoil/smartSearchAtom";
import { useSmartSearch } from "../../helpers/useSmartSearch";

const SearchTerm = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [, setSelectionOptions] = useRecoilState(selectionOptionsState);
  const { mode } = useRecoilValue(smartSearchState);
  const { runSearch } = useSmartSearch();

  const isSmartMode = mode === "smart";

  // Switching modes resets the box so a keyword filter never lingers behind a
  // smart query (and vice versa). Skips the initial mount.
  const previousModeRef = useRef(mode);
  useEffect(() => {
    if (previousModeRef.current === mode) return;
    previousModeRef.current = mode;
    setSearchTerm("");
    setSelectionOptions((prev) => ({ ...prev, searchTerm: "" }));
  }, [mode, setSelectionOptions]);

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    // Smart queries are sentences, not filters: they must never narrow the
    // keyword-filtered pool. They are only sent on Enter.
    if (isSmartMode) return;
    setSelectionOptions((prev) => ({
      ...prev,
      searchTerm: value,
    }));
  };

  const handleFocus = () => {
    if (isSmartMode) return; // keep the query so it can be edited and re-run
    setSearchTerm("");
    setSelectionOptions((prev) => ({
      ...prev,
      searchTerm: "",
    }));
  };

  const handleKeyDown = (e) => {
    if (isSmartMode && e.key === "Enter") {
      runSearch(searchTerm);
    }
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
        placeholder={
          isSmartMode ? "Describe what you want to learn…" : "Search"
        }
        value={searchTerm}
        onChange={handleSearch}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        style={{ marginBottom: "10px" }}
      />
    </div>
  );
};

export { SearchTerm };
