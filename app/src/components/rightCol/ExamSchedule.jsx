import PropTypes from "prop-types";
import moment from "moment/moment";
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
  isPlannedCourse,
} from "../helpers/examScheduleUtils";
import { getCourseRootKey } from "../helpers/courseUtils";

const MESSAGE_CLASS = "pb-1 text-sm text-gray-700";

export default function ExamSchedule({ course, semester }) {
  const { status, plan } = useRecoilValue(examPlanSelector(semester));
  const plannedExams = useRecoilValue(plannedExamsSelector(semester));
  const myCourses = useRecoilValue(myCoursesSelector(semester));

  if (status === "error") {
    return (
      <p className={MESSAGE_CLASS}>
        Exam dates could not be loaded — reload to retry.
      </p>
    );
  }
  // Loading, never ingested, or a semester whose exams must not be shown:
  // without a plan to judge by, even "decentral" would be a guess.
  if (status !== "ready") return null;

  const publishedAt = moment(plan.source.publishedAt, "YYYY-MM-DD");
  const footnote = (
    <p className="flex items-start gap-1 pt-1 text-xs text-gray-500">
      <InformationCircleIcon
        aria-hidden="true"
        className="mt-0.5 h-4 w-4 flex-shrink-0"
      />
      <span>
        Central exam schedule {plan.sourceTermLabel}, published{" "}
        {publishedAt.format("DD.MM.YYYY")}. {EXAM_DISCLAIMER_LONG}
      </span>
    </p>
  );

  const { written, oral } = examsForCourse(plan, course);
  if (written.length === 0 && oral.length === 0) {
    const { isCentral, isDeCentral } = course?.achievementFormStatus ?? {};
    if (isDeCentral && !isCentral) {
      return (
        <p className={MESSAGE_CLASS}>
          Decentral exam — scheduled by the lecturer.
        </p>
      );
    }
    // A central exam the extraction missed, or a course number it cannot be
    // looked up by, must not read as "no central exam".
    if (isCentral || !getCourseRootKey(course)) {
      return (
        <div className="pb-2 text-sm text-gray-700">
          <p>
            Central exam date not found in the extracted schedule — check the
            official exam plan.
          </p>
          {footnote}
        </div>
      );
    }
    return <p className={MESSAGE_CLASS}>Not in the central exam schedule.</p>;
  }

  const clashes = examClashes(plannedExams, plan, course);
  const planned = isPlannedCourse(myCourses, course);

  return (
    <div className="pb-2 text-sm text-gray-700">
      {written.map((exam) => (
        <div key={exam.id}>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold">{formatExamDate(exam.date)}</span>
            <span>{exam.slot}</span>
            <span>{formatExamMeta(exam)}</span>
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
      {footnote}
    </div>
  );
}

ExamSchedule.propTypes = {
  course: PropTypes.object,
  semester: PropTypes.string,
};
