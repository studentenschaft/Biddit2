import { describe, it, expect } from "vitest";
import { isExerciseGroup } from "../smartExerciseGroupHandler";

const EXERCISE_GROUP_NAMES = [
  "Marketing: Übungen und Selbststudium (Uhrenindustrie), Gruppe 3",
  "Leadership und Human Resource Management: Übungen und Selbststudium, Gruppe 4",
  "Betriebswirtschaftslehre: Übungen und Selbststudium, Gruppe 2",
  "Linear Algebra: Exercises, Group 1",
  "Fundamentals and Methods of Computer Science for Business Studies: Exercises (basic), Group 8",
  "Corporate Finance (BBWL): Exercises",
];

const REGULAR_COURSE_NAMES = [
  "1,725,1.00 Psychologie: Coaching und Gesprächsführung",
  "7,556,1.00 Kursübergreifendes Mathe-Coaching",
  "7,556,1.00 …: Coachingsituationen gestalten",
];

describe("smartExerciseGroupHandler", () => {
  it.each(EXERCISE_GROUP_NAMES)(
    "marks %s as an exercise group",
    (courseName) => {
      expect(isExerciseGroup({ name: courseName, credits: 100 })).toBe(true);
    }
  );

  it.each(REGULAR_COURSE_NAMES)(
    "does not mark %s as an exercise group",
    (courseName) => {
      expect(isExerciseGroup({ name: courseName, credits: 300 })).toBe(false);
    }
  );
});
