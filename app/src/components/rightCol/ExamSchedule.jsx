import PropTypes from "prop-types";
import { InformationCircleIcon } from "@heroicons/react/outline";
import { useRecoilValue } from "recoil";
import {
  examPlanSelector,
  plannedExamsSelector,
} from "../recoil/examScheduleSelectors";
import { myCoursesSelector } from "../recoil/unifiedCourseDataSelectors";
import {
  EXAM_DISCLAIMER_LONG,
  examClashes,
  examsForCourse,
  formatExamClash,
  formatExamDate,
  formatExamDateRange,
  formatExamMeta,
  formatPlanSource,
  isPlannedCourse,
} from "../helpers/examScheduleUtils";
import { getCourseRootKey } from "../helpers/courseUtils";

const MESSAGE_CLASS = "pb-1 text-sm text-gray-700";

export default function ExamSchedule({ course, semester }) {
  const { status, plan } = useRecoilValue(examPlanSelector(semester));

  // Only a ready plan can list a course.
  const exams = status === "ready" ? examsForCourse(plan, course) : null;
  if (exams && (exams.written.length > 0 || exams.oral.length > 0)) {
    return (
      <ListedExams course={course} semester={semester} plan={plan} {...exams} />
    );
  }

  // "Decentral" is the course's own fact, not the plan's, so it holds
  // whatever state the plan is in.
  const { isCentral, isDeCentral } = course?.achievementFormStatus ?? {};
  if (isDeCentral && !isCentral) {
    return (
      <p className={MESSAGE_CLASS}>
        Decentral exam — scheduled by the lecturer.
      </p>
    );
  }
  if (status === "error") {
    return (
      <p className={MESSAGE_CLASS}>
        Exam dates could not be loaded — reload to retry.
      </p>
    );
  }
  // Loading, never ingested, or a semester whose exams must not be shown.
  if (status !== "ready") return null;

  // A central exam the extraction missed, or a course number it cannot be
  // looked up by, must not read as "no central exam".
  if (isCentral || !getCourseRootKey(course)) {
    return (
      <div className="pb-2 text-sm text-gray-700">
        <p>
          Central exam date not found in the extracted schedule — check the
          official exam plan.
        </p>
        <PlanFootnote plan={plan} />
      </div>
    );
  }
  return <p className={MESSAGE_CLASS}>Not in the central exam schedule.</p>;
}

ExamSchedule.propTypes = {
  course: PropTypes.object,
  semester: PropTypes.string,
};

// Split out so only a listed course subscribes to the user's courses, the
// one thing clash lines need.
function ListedExams({ course, semester, plan, written, oral }) {
  const plannedExams = useRecoilValue(plannedExamsSelector(semester));
  const myCourses = useRecoilValue(myCoursesSelector(semester));
  const clashes = examClashes(plannedExams, plan, course);
  const planned = isPlannedCourse(myCourses, course);

  return (
    <div className="pb-2 text-sm text-gray-700">
      {written.map((exam) => (
        <div key={exam.id}>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold">{formatExamDate(exam.date)}</span>
            <span>{exam.slot}</span>
            <span>{formatExamMeta({ durationMin: exam.durationMin })}</span>
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
              {formatExamClash(clashes.get(exam.id), planned)}
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
      <PlanFootnote plan={plan} />
    </div>
  );
}

ListedExams.propTypes = {
  course: PropTypes.object.isRequired,
  semester: PropTypes.string.isRequired,
  plan: PropTypes.object.isRequired,
  written: PropTypes.arrayOf(PropTypes.object).isRequired,
  oral: PropTypes.arrayOf(PropTypes.object).isRequired,
};

function PlanFootnote({ plan }) {
  return (
    <p className="flex items-start gap-1 pt-1 text-xs text-gray-500">
      <InformationCircleIcon
        aria-hidden="true"
        className="mt-0.5 h-4 w-4 flex-shrink-0"
      />
      <span>
        {formatPlanSource(plan)}. {EXAM_DISCLAIMER_LONG}
      </span>
    </p>
  );
}

PlanFootnote.propTypes = {
  plan: PropTypes.object.isRequired,
};
