import { InformationCircleIcon } from "@heroicons/react/outline";
import { useSetRecoilState } from "recoil";
import { selectedTabAtom } from "../../../recoil/selectedTabAtom";

const CURRICULUM_MAP_TAB_INDEX = 5;

const StudyOverviewMigrationNotice = () => {
  const setSelectedTab = useSetRecoilState(selectedTabAtom);

  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 p-3">
      <InformationCircleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
      <p className="flex-1 text-sm text-amber-700">
        Study Overview will soon be replaced by the new Curriculum Map. {" "}
        <button
          type="button"
          onClick={() => setSelectedTab(CURRICULUM_MAP_TAB_INDEX)}
          className="font-medium underline decoration-amber-400 underline-offset-2 hover:text-amber-900"
        >
          Open Curriculum Map →
        </button>
      </p>
    </div>
  );
};

export default StudyOverviewMigrationNotice;
