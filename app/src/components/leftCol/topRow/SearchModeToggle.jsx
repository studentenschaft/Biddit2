import { useRecoilState } from "recoil";
import { smartSearchState } from "../../recoil/smartSearchAtom";

const baseStyle =
  "flex-1 py-1 text-xs font-medium rounded-md transition-colors";

/**
 * Switches the course list between keyword filtering and semantic search.
 * Changing mode drops any previous smart results so the list never shows
 * matches for a query the user has moved on from.
 */
export default function SearchModeToggle() {
  const [search, setSearch] = useRecoilState(smartSearchState);

  const setMode = (mode) =>
    setSearch((prev) => ({
      ...prev,
      mode,
      hasSearched: false,
      resultIds: [],
      distances: [],
    }));

  return (
    <div
      className="flex gap-1 p-0.5 mb-1 bg-gray-100 rounded-lg"
      role="group"
      aria-label="Search mode"
    >
      <button
        type="button"
        onClick={() => setMode("keyword")}
        aria-pressed={search.mode === "keyword"}
        className={`${baseStyle} ${
          search.mode === "keyword"
            ? "bg-hsg-800 text-white"
            : "text-gray-600 hover:bg-gray-200"
        }`}
      >
        Keyword
      </button>
      <button
        type="button"
        onClick={() => setMode("smart")}
        aria-pressed={search.mode === "smart"}
        className={`${baseStyle} ${
          search.mode === "smart"
            ? "bg-hsg-800 text-white"
            : "text-gray-600 hover:bg-gray-200"
        }`}
      >
        Smart ✨
      </button>
    </div>
  );
}

export { SearchModeToggle };
