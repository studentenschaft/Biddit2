# ADR 0012: An exam clash is a time overlap between two distinct exams of different courses

- **Status:** Accepted
- **Date:** 2026-08-27, revised 2026-09-23

## Context

The exam-plan PDF tells students that they alone must avoid exam clashes when
bidding, and that no exceptions are granted. The app knows the student's
courses and, through ADR 0011, their central written exams, so it can do the
check — for the courses already in the plan and for the ones the student is
still considering. A missed clash costs a student an exam; a false one teaches
them to ignore the right ones.

## Decision

**The planned exams** are the OT written exams of the user's courses in the
selected semester: `myCoursesSelector`, enrolled ∪ wishlisted, never the
filtered list view, so a search filter cannot silence a warning. Each exam
counts once. A lecture and its exercise groups share a root, and a cross-listed
exam matches several roots, but either way it is one sitting, named after the
first of the user's courses that sits it.

**A clash** between an exam of course C and a planned exam needs all three:

- a *different* exam (`id`): the same exam reached through a second listing is
  the same sitting;
- sat for a course with a *different* root than C: an exam that C's own root
  sits is not a clash between courses;
- overlapping intervals `[start, start + duration)`: exams that only touch do
  not clash.

Interval arithmetic rather than grouping by date and slot, so a plan with other
start times stays correct. On HS26, where every exam starts at 09:15 or 15:15
and none runs into the afternoon, both rules find the same clashes, except that
grouping by slot also flagged a cross-listed exam against itself.

**OT written exams only.** The AT rows are another semester's alternative dates
(ADR 0010), and oral exams have no published times. A warning built on either
would be a guess.

**"Would clash" for courses being browsed.** A course the student has not
planned is checked against the planned exams as well: the PDF tells students
not to bid on clashing courses, so the warning matters most before the bid. It
has the same icon and red, and reads "Exam would clash with" instead of "Exam
clash with". A course counts as planned when its root is among the roots of the
user's courses — not among the planned exams' names, which name a cross-listed
exam once — so a second listing the user also planned still reads as a clash.

**Where it shows, and how.** Wherever the app lists the user's courses or
exams, an exam clash is red (lecture overlaps stay amber), dashed on the
Calendar, where a phone cuts the words off and colour alone fails colour-blind
users, and always disclaimed: the dates are our extraction, not the
university's publication.

## Consequences

- AT and oral clashes are invisible; students sitting alternative dates must
  still check by hand, and the CW42 re-ingest does not change that.
- Two overlapping exams of the same root are not reported against each other.
  HS26 has none.
- A plan with a third start time or free-form times needs no change here; the
  parser still requires every exam to sit under a labelled column (ADR 0010).
- A browsed row can show red before the student has done anything. That is
  the point: the warning is about the bid.
- The course list and the Summary name each clashing course once, however many
  of its exams clash; Course Details and the Calendar report per exam.
