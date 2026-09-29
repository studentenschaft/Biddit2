import PropTypes from "prop-types";
import { ExclamationIcon } from "@heroicons/react/outline";
import { useRecoilValue } from "recoil";
import {
  examPlanSelector,
  plannedExamsSelector,
} from "../recoil/examScheduleSelectors";
import { myCoursesSelector } from "../recoil/unifiedCourseDataSelectors";
import {
  EXAM_TABLE_DISCLAIMER,
  examClashes,
  examTableRows,
  formatExamClash,
  formatExamDate,
  formatExamDateRange,
} from "../helpers/examScheduleUtils";

/**
 * The course list's md+ twelve-column row. Five text-heavy columns cannot
 * squeeze onto a phone the way the course list's do, so below 36rem the table
 * scrolls sideways instead.
 */
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
  // clashes of the first that reports any, as in the calendar.
  const clashOf = ({ exam, oral, courses }) =>
    oral
      ? undefined
      : courses
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
          <p className="font-bold">{EXAM_TABLE_DISCLAIMER.heading}</p>
          <p>{EXAM_TABLE_DISCLAIMER.body(plan)}</p>
        </div>
      </div>

      {/* p-px: the rows' outline is a 1px ring drawn outside the box, which
          the scroll container would otherwise clip. */}
      <div className="overflow-x-auto p-px">
        <div
          role="table"
          aria-labelledby="exam-table-heading"
          className="min-w-[36rem]"
        >
          <div
            role="row"
            className={`${ROW_GRID_CLASSES} px-2 py-1 pb-2 text-sm font-semibold text-gray-900 rounded`}
          >
            <div role="columnheader" className="col-span-2">
              Date
            </div>
            <div role="columnheader" className="col-span-2">
              Time
            </div>
            <div role="columnheader" className="col-span-3">
              Course
            </div>
            <div role="columnheader" className="col-span-2">
              BYOD
            </div>
            <div role="columnheader" className="col-span-3">
              Clash
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
                  <div role="cell" className="col-span-2">
                    {oral
                      ? formatExamDateRange(exam.dateStart, exam.dateEnd)
                      : formatExamDate(exam.date)}
                  </div>
                  <div role="cell" className="col-span-2">
                    {oral
                      ? "Oral — individual time in Compass"
                      : `${exam.slot} · ${exam.durationMin} min`}
                  </div>
                  <div
                    role="cell"
                    className="col-span-3 min-w-0 font-semibold truncate"
                  >
                    {courses.map((course, index) => (
                      <span key={course.courseNumber ?? index}>
                        {index > 0 && ", "}
                        <span
                          className="cursor-pointer"
                          onClick={() => onOpenCourse(course)}
                        >
                          {course.shortName}
                        </span>
                      </span>
                    ))}
                  </div>
                  <div role="cell" className="col-span-2">
                    {/* Present-or-silent, never "not BYOD". */}
                    {exam.byod === true && (
                      <span className="rounded bg-hsg-100 px-1 text-xs text-hsg-800">
                        digital (BYOD)
                      </span>
                    )}
                  </div>
                  <div role="cell" className="col-span-3 min-w-0 break-words">
                    {clash && (
                      <span className="text-danger">
                        {formatExamClash(clash, true)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

ExamTable.propTypes = {
  semester: PropTypes.string,
  onOpenCourse: PropTypes.func.isRequired,
};
