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
 * Compact rescue of the retired Smart Search tab's green intro panel: without
 * it nothing tells the user that this box wants a description rather than a
 * course title. Shown only in smart mode, where the advice applies.
 */
function SmartSearchHint() {
  return (
    <div className="p-2 mb-1 text-xs rounded-md bg-green-50 text-gray-600">
      <p>Find courses based on what they&apos;re really about!</p>
      <p className="mt-1">✨ Try descriptive phrases like:</p>
      <p className="font-medium text-green-700">
        &quot;Programming basics&quot; · &quot;History and Asia&quot;
      </p>
    </div>
  );
}

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
    <>
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
      {search.mode === "smart" && <SmartSearchHint />}
    </>
  );
}
