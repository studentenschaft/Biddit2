import PropTypes from "prop-types";
import { useRecoilValue } from "recoil";
import { semesterMetadataSelector } from "../recoil/unifiedCourseDataSelectors";
import { useExamSchedule } from "../helpers/useExamSchedule";
import { examsForCourse } from "../helpers/examScheduleUtils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// The artifact stores plain calendar days ("2027-01-18"); parsing them in UTC
// keeps the weekday independent of the reader's timezone.
const formatDay = (isoDay) => {
  const [year, month, day] = String(isoDay ?? "").split("-");
  return year && month && day ? `${day}.${month}.${year}` : "";
};

const formatExamDate = (isoDay) => {
  const formatted = formatDay(isoDay);
  if (!formatted) return "";
  const [year, month, day] = String(isoDay).split("-");
  const weekday =
    WEEKDAYS[new Date(Date.UTC(+year, +month - 1, +day)).getUTCDay()];
  return weekday ? `${weekday} ${formatted}` : formatted;
};

export default function ExamSchedule({ course, semester }) {
  const semesterMetadata = useRecoilValue(semesterMetadataSelector(semester));
  // Borrowed catalogs (projected term, or a current term previewing the
  // previous year) show courses that are not actually running this term, so
  // their exam dates would be someone else's. See REFERENCE_SEMESTER.md.
  const isBorrowedData =
    semesterMetadata.isFutureSemester || semesterMetadata.usingReferenceData;
  const schedule = useExamSchedule(isBorrowedData ? null : semester);

  const achievementFormStatus = course?.achievementFormStatus;
  if (achievementFormStatus?.isDeCentral && !achievementFormStatus.isCentral) {
    return (
      <p className="pb-1 text-sm text-gray-700">
        Decentral exam — scheduled by the lecturer.
      </p>
    );
  }

  if (!schedule?.plan) return null;

  const { written, oral } = examsForCourse(schedule.plan, course);
  if (written.length === 0 && oral.length === 0) {
    return (
      <p className="pb-1 text-sm text-gray-700">
        Not in the central exam schedule.
      </p>
    );
  }

  return (
    <div className="pb-2 text-sm text-gray-700">
      {written.map((exam) => (
        <div key={exam.id} className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold">{formatExamDate(exam.date)}</span>
          <span>{exam.slot}</span>
          <span>{exam.durationMin} min</span>
          {exam.termType === "AT" && (
            <span className="text-gray-500">Alternative date</span>
          )}
          {/* The plan only marks BYOD when the title spells it out, so this
              badge is present-or-silent — never "not BYOD". */}
          {exam.byod === true && (
            <span className="rounded bg-hsg-100 px-1 text-xs text-hsg-800">
              digital (BYOD)
            </span>
          )}
        </div>
      ))}
      {oral.map((exam) => (
        <div key={exam.id} className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold">{formatExamDate(exam.date)}</span>
          <span>Oral exam — individual time published in Compass</span>
        </div>
      ))}
      <p className="pt-1 text-xs text-gray-500">
        Central exam schedule {schedule.plan.sourceTermLabel}, published{" "}
        {formatDay(schedule.plan.source?.publishedAt)}
      </p>
    </div>
  );
}

ExamSchedule.propTypes = {
  course: PropTypes.object,
  semester: PropTypes.string,
};
