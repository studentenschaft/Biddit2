import PropTypes from "prop-types";
import { ExclamationIcon } from "@heroicons/react/outline";
import { useRecoilValue } from "recoil";
import {
  examPlanSelector,
  plannedExamsSelector,
} from "../recoil/examScheduleSelectors";
import { myCoursesSelector } from "../recoil/unifiedCourseDataSelectors";
import {
  examClashes,
  examTableRows,
  formatExamClash,
  formatExamDate,
  formatExamDateRange,
  formatPlanSource,
} from "../helpers/examScheduleUtils";

// Date, time and course only: BYOD sits under the time and a clash under the
// course name, so a phone shows the whole row without scrolling sideways.
const ROW_GRID_CLASSES = "grid grid-cols-12 gap-2 md:gap-4";

/**
 * The central exams of the user's courses for `semester`, under a warning
 * that the dates are our own extraction. Nothing unless a ready plan lists at
 * least one of them: the "Exam check" line above explains every other state.
 */
export default function ExamTable({ semester, onOpenCourse }) {
  const { status, plan } = useRecoilValue(examPlanSelector(semester));
  const plannedExams = useRecoilValue(plannedExamsSelector(semester));
  const myCourses = useRecoilValue(myCoursesSelector(semester));

  const rows = status === "ready" ? examTableRows(plan, myCourses) : [];
  if (rows.length === 0) return null;

  // An exam sat by several of my roots (a cross-listing) is red with the
  // clashes of the first that reports any, as in the calendar. Oral exams
  // never clash: `examClashes` keys written exams only.
  const clashOf = ({ exam, courses }) =>
    courses
      .map((course) => examClashes(plannedExams, plan, course).get(exam.id))
      .find(Boolean);

  return (
    <div className="mt-4">
      {/* Heading first, so the warning below reads as being about the exams,
          not the course table above. */}
      <h3
        id="exam-table-heading"
        className="px-2 pb-2 text-sm font-semibold text-gray-900"
      >
        Central exams
      </h3>
      <div
        role="note"
        className="mb-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900"
      >
        <ExclamationIcon
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 flex-shrink-0"
        />
        <div className="text-sm">
          <p className="font-bold">
            Automatically extracted — verify before relying on it
          </p>
          <p>
            {`These dates were extracted automatically from the university's central exam plan (${formatPlanSource(plan)}). We cannot guarantee they are complete or correct — treat them as an early indicator only and always check the official exam schedule.`}
          </p>
        </div>
      </div>

      <div role="table" aria-labelledby="exam-table-heading">
        <div
          role="row"
          className={`${ROW_GRID_CLASSES} px-2 py-1 pb-2 text-sm font-semibold text-gray-900 rounded`}
        >
          <div role="columnheader" className="col-span-3">
            Date
          </div>
          <div role="columnheader" className="col-span-3">
            Time
          </div>
          <div role="columnheader" className="col-span-6">
            Course
          </div>
        </div>
        <div
          role="rowgroup"
          className="ring-1 ring-black ring-opacity-5 md:rounded-lg"
        >
          {rows.map((row) => {
            const { exam, oral, courses } = row;
            const clash = clashOf(row);
            return (
              <div
                key={exam.id}
                role="row"
                className={`${ROW_GRID_CLASSES} px-2 py-1 text-sm text-gray-900 rounded group hover:bg-gray-300`}
              >
                <div role="cell" className="col-span-3">
                  {oral
                    ? formatExamDateRange(exam.dateStart, exam.dateEnd)
                    : formatExamDate(exam.date)}
                </div>
                <div role="cell" className="col-span-3">
                  <div>
                    {oral
                      ? "Oral — individual time in Compass"
                      : `${exam.slot} · ${exam.durationMin} min`}
                  </div>
                  {/* Present-or-silent, never "not BYOD". */}
                  {exam.byod === true && (
                    <span className="inline-block rounded bg-hsg-100 px-1 text-xs text-hsg-800">
                      digital (BYOD)
                    </span>
                  )}
                </div>
                <div role="cell" className="col-span-6 min-w-0 break-words">
                  <div>
                    {courses.map((course, index) => (
                      <span key={course.courseNumber ?? index}>
                        {index > 0 && ", "}
                        <button
                          type="button"
                          className="text-left font-semibold hover:underline"
                          onClick={() => onOpenCourse(course)}
                        >
                          {course.shortName}
                        </button>
                      </span>
                    ))}
                  </div>
                  {clash && (
                    <div className="text-danger">
                      {formatExamClash(clash, true)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

ExamTable.propTypes = {
  semester: PropTypes.string,
  onOpenCourse: PropTypes.func.isRequired,
};
