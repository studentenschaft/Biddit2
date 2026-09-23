import PropTypes from "prop-types";
import moment from "moment/moment";
import { InformationCircleIcon } from "@heroicons/react/outline";
import { useRecoilValue } from "recoil";
import {
  examPlanSelector,
  plannedExamsSelector,
} from "../recoil/examScheduleSelectors";
import {
  examClashes,
  examsForCourse,
  formatExamDate,
  formatExamDateRange,
} from "../helpers/examScheduleUtils";
import { getCourseRootKey } from "../helpers/courseUtils";

export default function ExamSchedule({ course, semester }) {
  // Null while loading, and for a semester without a usable plan or with a
  // borrowed catalog.
  const { plan } = useRecoilValue(examPlanSelector(semester));
  const plannedExams = useRecoilValue(plannedExamsSelector(semester));

  const achievementFormStatus = course?.achievementFormStatus;
  if (achievementFormStatus?.isDeCentral && !achievementFormStatus.isCentral) {
    return (
      <p className="pb-1 text-sm text-gray-700">
        Decentral exam — scheduled by the lecturer.
      </p>
    );
  }

  if (!plan) return null;

  const { written, oral } = examsForCourse(plan, course);
  if (written.length === 0 && oral.length === 0) {
    return (
      <p className="pb-1 text-sm text-gray-700">
        Not in the central exam schedule.
      </p>
    );
  }

  // Only a planned course warns; a browsed one is not competing yet.
  const rootKey = getCourseRootKey(course);
  const clashes = plannedExams.some((planned) => planned.rootKey === rootKey)
    ? examClashes(plannedExams, plan, course)
    : new Map();

  return (
    <div className="pb-2 text-sm text-gray-700">
      {written.map((exam) => (
        <div key={exam.id}>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold">{formatExamDate(exam.date)}</span>
            <span>{exam.slot}</span>
            <span>{exam.durationMin} min</span>
            {/* Present-or-silent: shows the plan's BYOD marking, never "not
                BYOD". */}
            {exam.byod === true && (
              <span className="rounded bg-hsg-100 px-1 text-xs text-hsg-800">
                digital (BYOD)
              </span>
            )}
          </div>
          {clashes.has(exam.id) && (
            <p className="text-danger">
              Overlaps with {clashes.get(exam.id).join(", ")}
            </p>
          )}
        </div>
      ))}
      {oral.map((exam) => (
        <div key={exam.id} className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold">
            {formatExamDateRange(exam.dateStart, exam.dateEnd)}
          </span>
          <span>Oral exam — individual time published in Compass</span>
        </div>
      ))}
      <p className="flex items-start gap-1 pt-1 text-xs text-gray-500">
        <InformationCircleIcon
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 flex-shrink-0"
        />
        <span>
          Central exam schedule {plan.sourceTermLabel}, published{" "}
          {moment(plan.source.publishedAt, "YYYY-MM-DD").format("DD.MM.YYYY")}.
          Extracted
          automatically from the official PDF — indicative only, always verify
          against the official exam schedule.
        </span>
      </p>
    </div>
  );
}

ExamSchedule.propTypes = {
  course: PropTypes.object,
  semester: PropTypes.string,
};
