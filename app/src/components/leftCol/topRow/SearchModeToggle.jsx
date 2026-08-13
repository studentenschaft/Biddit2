import { useRecoilState, useSetRecoilState } from "recoil";
import { selectionOptionsState } from "../../recoil/selectionOptionsAtom";
import { smartSearchState } from "../../recoil/smartSearchAtom";

const baseStyle =
  "flex-1 py-1 text-xs font-medium rounded-md transition-colors";

const MODES = [
  ["keyword", "Keyword"],
  ["smart", "Smart ✨"],
];

/**
 * Switches the course list between keyword filtering and semantic search.
 * Changing mode drops any previous smart results and the keyword filter term,
 * so the list never shows matches for a query the user has moved on from.
 * The visible input is cleared by SelectOptions keying <SearchTerm> on the mode.
 */
export default function SearchModeToggle() {
  const [search, setSearch] = useRecoilState(smartSearchState);
  const setSelectionOptions = useSetRecoilState(selectionOptionsState);

  const setMode = (mode) => {
    if (mode !== search.mode) {
      setSelectionOptions((prev) => ({ ...prev, searchTerm: "" }));
    }
    setSearch((prev) => ({
      ...prev,
      mode,
      hasSearched: false,
      resultIds: [],
      distances: [],
    }));
  };

  return (
    <div
      className="flex gap-1 p-0.5 mb-1 bg-gray-100 rounded-lg"
      role="group"
      aria-label="Search mode"
    >
      {MODES.map(([mode, label]) => (
        <button
          key={mode}
          type="button"
          onClick={() => setMode(mode)}
          aria-pressed={search.mode === mode}
          className={`${baseStyle} ${
            search.mode === mode
              ? "bg-hsg-800 text-white"
              : "text-gray-600 hover:bg-gray-200"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
