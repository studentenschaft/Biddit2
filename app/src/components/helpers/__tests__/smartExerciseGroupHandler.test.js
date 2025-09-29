import { describe, it, expect } from "vitest";
import { isExerciseGroup, processExerciseGroupECTS } from "../smartExerciseGroupHandler";

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

  it("zeroes exercise group ECTS when main and exercise share the same root course number", () => {
    const main = {
      name: "Accounting, Controlling, Auditing",
      credits: 400,
      courseNumber: "3,135,1.00",
    };
    const exercise = {
      name: "Accounting, Controlling, Auditing: Exercises and Independent Studies",
      credits: 400,
      courseNumber: "3,135,2.04",
    };

    // Sanity: detected as exercise group
    expect(isExerciseGroup(exercise)).toBe(true);
    expect(isExerciseGroup(main)).toBe(false);

    const processed = processExerciseGroupECTS([main, exercise]);
    const processedMain = processed.find(c => c.name === main.name);
    const processedEx = processed.find(c => c.name !== main.name);

    expect(processedMain.credits).toBe(400);
    expect(processedEx.credits).toBe(0);
  });

  it("keeps credits for standalone exercise group without matching main root", () => {
    const exerciseOnly = {
      name: "Accounting, Controlling, Auditing: Exercises and Independent Studies",
      credits: 400,
      courseNumber: "9,999,9.99",
    };

    const processed = processExerciseGroupECTS([exerciseOnly]);
    expect(processed[0].credits).toBe(400);
  });
});
