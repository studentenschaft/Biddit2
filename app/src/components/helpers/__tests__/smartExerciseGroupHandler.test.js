import { describe, it, expect } from "vitest";
import { isExerciseGroup, processExerciseGroupECTS, extractBaseName, isLikelySubgroupByNumber } from "../smartExerciseGroupHandler";

const EXERCISE_GROUP_NAMES = [
  "Marketing: Übungen und Selbststudium (Uhrenindustrie), Gruppe 3",
  "Leadership und Human Resource Management: Übungen und Selbststudium, Gruppe 4",
  "Betriebswirtschaftslehre: Übungen und Selbststudium, Gruppe 2",
  "Linear Algebra: Exercises, Group 1",
  "Fundamentals and Methods of Computer Science for Business Studies: Exercises (basic), Group 8",
  "Corporate Finance (BBWL): Exercises",
  "Secure & Private Computing: Foundations of Ethical Hacking: Übungen",
  "Corporate Finance (BBWL): Case Studies, Group 1",
  "Corporate Finance (BBWL): Case Studies, Group 2",
  "Corporate Finance (BBWL): Case Studies",
  "Volkswirtschaftslehre: Fallstudien, Gruppe 3",
];

const REGULAR_COURSE_NAMES = [
  "1,725,1.00 Psychologie: Coaching und Gesprächsführung",
  "7,556,1.00 Kursübergreifendes Mathe-Coaching",
  "7,556,1.00 …: Coachingsituationen gestalten",
  "Case Study Methods in Social Science",
  "Introduction to Case Studies",
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

  it("zeroes Case Studies group ECTS when main course shares the same root key", () => {
    const main = {
      name: "Corporate Finance (BBWL)",
      credits: 400,
      courseNumber: "4,130,1.00",
    };
    const caseStudy = {
      name: "Corporate Finance (BBWL): Case Studies, Group 1",
      credits: 400,
      courseNumber: "4,130,2.01",
    };

    expect(isExerciseGroup(caseStudy)).toBe(true);
    expect(isExerciseGroup(main)).toBe(false);

    const processed = processExerciseGroupECTS([main, caseStudy]);
    const processedMain = processed.find(c => c.name === main.name);
    const processedCS = processed.find(c => c.name === caseStudy.name);

    expect(processedMain.credits).toBe(400);
    expect(processedCS.credits).toBe(0);
  });

  it("extractBaseName strips Case Studies suffix to produce the base name", () => {
    expect(extractBaseName("Corporate Finance (BBWL): Case Studies, Group 1"))
      .toBe("Corporate Finance (BBWL)");
    expect(extractBaseName("Volkswirtschaftslehre: Fallstudien, Gruppe 3"))
      .toBe("Volkswirtschaftslehre");
  });

  // --- Number-based subgroup detection ---

  it("isLikelySubgroupByNumber detects 2.xx with 1.xx sibling", () => {
    const main = { courseNumber: "4,135,1.00" };
    const sub = { courseNumber: "4,135,2.01" };
    const group = [main, sub];

    expect(isLikelySubgroupByNumber(sub, group)).toBe(true);
    expect(isLikelySubgroupByNumber(main, group)).toBe(false);
  });

  it("isLikelySubgroupByNumber detects 3.xx (coaching) with 1.xx sibling", () => {
    const main = { courseNumber: "4,125,1.00" };
    const exercise = { courseNumber: "4,125,2.01" };
    const coaching = { courseNumber: "4,125,3.00" };
    const group = [main, exercise, coaching];

    expect(isLikelySubgroupByNumber(coaching, group)).toBe(true);
    expect(isLikelySubgroupByNumber(exercise, group)).toBe(true);
    expect(isLikelySubgroupByNumber(main, group)).toBe(false);
  });

  it("isLikelySubgroupByNumber returns false without 1.xx sibling", () => {
    const a = { courseNumber: "4,135,2.01" };
    const b = { courseNumber: "4,135,2.02" };

    expect(isLikelySubgroupByNumber(a, [a, b])).toBe(false);
  });

  it("zeroes subgroup ECTS via course number when regex does not match the name", () => {
    const main = {
      name: "Advanced Topic XYZ",
      credits: 400,
      courseNumber: "7,999,1.00",
    };
    const subgroup = {
      name: "Advanced Topic XYZ: Supplementary Sessions, Group 1",
      credits: 400,
      courseNumber: "7,999,2.01",
    };

    // Regex does NOT detect these
    expect(isExerciseGroup(main)).toBe(false);
    expect(isExerciseGroup(subgroup)).toBe(false);

    const processed = processExerciseGroupECTS([main, subgroup]);
    expect(processed.find(c => c.courseNumber === "7,999,1.00").credits).toBe(400);
    expect(processed.find(c => c.courseNumber === "7,999,2.01").credits).toBe(0);
  });

  it("keeps credits for a 2.xx course when no 1.xx sibling exists", () => {
    const solo = {
      name: "Standalone Seminar",
      credits: 400,
      courseNumber: "5,555,2.00",
    };

    const processed = processExerciseGroupECTS([solo]);
    expect(processed[0].credits).toBe(400);
  });

  // --- Real-world course families (Faculty 4, 7) ---

  it("zeroes all exercise groups in Accounting, Controlling, Auditing family (4,135)", () => {
    const courses = [
      { name: "Accounting, Controlling, Auditing", credits: 400, courseNumber: "4,135,1.00" },
      { name: "Accounting, Controlling, Auditing: Übungen und Selbststudium, Gruppe 1", credits: 400, courseNumber: "4,135,2.01" },
      { name: "Accounting, Controlling, Auditing: Übungen und Selbststudium, Gruppe 2", credits: 400, courseNumber: "4,135,2.02" },
      { name: "Accounting, Controlling, Auditing: Übungen und Selbststudium, Gruppe 3", credits: 400, courseNumber: "4,135,2.03" },
      { name: "Accounting, Controlling, Auditing: Übungen und Selbststudium, Gruppe 4", credits: 400, courseNumber: "4,135,2.04" },
      { name: "Accounting, Controlling, Auditing: Übungen und Selbststudium, Gruppe 5", credits: 400, courseNumber: "4,135,2.05" },
    ];

    const processed = processExerciseGroupECTS(courses);
    expect(processed.find(c => c.courseNumber === "4,135,1.00").credits).toBe(400);
    for (const p of processed.filter(c => c.courseNumber !== "4,135,1.00")) {
      expect(p.credits).toBe(0);
    }
  });

  it("zeroes exercise and coaching groups in Informatik family (4,125) including 3.xx", () => {
    const courses = [
      { name: "Grundlagen und Methoden der Informatik für Wirtschaftswissenschaften", credits: 400, courseNumber: "4,125,1.00" },
      { name: "Grundlagen und Methoden der Informatik für Wirtschaftswissenschaften: Übungen (basic), Gruppe 1", credits: 400, courseNumber: "4,125,2.01" },
      { name: "Grundlagen und Methoden der Informatik für Wirtschaftswissenschaften: Übungen (basic), Gruppe 2", credits: 400, courseNumber: "4,125,2.02" },
      { name: "Grundlagen und Methoden der Informatik für Wirtschaftswissenschaften: Übungen (basic), Gruppe 3", credits: 400, courseNumber: "4,125,2.03" },
      { name: "Grundlagen und Methoden der Informatik für Wirtschaftswissenschaften: Übungen (basic), Gruppe 4", credits: 400, courseNumber: "4,125,2.04" },
      { name: "Grundlagen und Methoden der Informatik für Wirtschaftswissenschaften: Coaching", credits: 400, courseNumber: "4,125,3.00" },
    ];

    const processed = processExerciseGroupECTS(courses);
    expect(processed.find(c => c.courseNumber === "4,125,1.00").credits).toBe(400);
    for (const p of processed.filter(c => c.courseNumber !== "4,125,1.00")) {
      expect(p.credits).toBe(0);
    }
  });

  it("zeroes exercise groups in Methods: Statistics family (4,120)", () => {
    const courses = [
      { name: "Methods: Statistics", credits: 400, courseNumber: "4,120,1.00" },
      { name: "Methods: Statistics: Exercises and Independent Studies, Group 1", credits: 400, courseNumber: "4,120,2.01" },
      { name: "Methods: Statistics: Exercises and Independent Studies, Group 2", credits: 400, courseNumber: "4,120,2.02" },
      { name: "Methods: Statistics: Exercises and Independent Studies, Group 3", credits: 400, courseNumber: "4,120,2.03" },
      { name: "Methods: Statistics: Exercises and Independent Studies, Group 4", credits: 400, courseNumber: "4,120,2.04" },
    ];

    const processed = processExerciseGroupECTS(courses);
    expect(processed.find(c => c.courseNumber === "4,120,1.00").credits).toBe(400);
    for (const p of processed.filter(c => c.courseNumber !== "4,120,1.00")) {
      expect(p.credits).toBe(0);
    }
  });

  it("zeroes exercise groups in Grundlagen Business Innovation family (7,000)", () => {
    const courses = [
      { name: "Grundlagen Business Innovation", credits: 400, courseNumber: "7,000,1.00" },
      { name: "Grundlagen Business Innovation: Übungen, Gruppe 1", credits: 400, courseNumber: "7,000,2.01" },
      { name: "Grundlagen Business Innovation: Übungen, Gruppe 2", credits: 400, courseNumber: "7,000,2.02" },
    ];

    const processed = processExerciseGroupECTS(courses);
    expect(processed.find(c => c.courseNumber === "7,000,1.00").credits).toBe(400);
    for (const p of processed.filter(c => c.courseNumber !== "7,000,1.00")) {
      expect(p.credits).toBe(0);
    }
  });

  it("zeroes exercise group in Advanced Cybersecurity family (7,850)", () => {
    const courses = [
      { name: "Advanced Cybersecurity", credits: 400, courseNumber: "7,850,1.00" },
      { name: "Advanced Cybersecurity: Exercises", credits: 400, courseNumber: "7,850,2.00" },
    ];

    const processed = processExerciseGroupECTS(courses);
    expect(processed.find(c => c.courseNumber === "7,850,1.00").credits).toBe(400);
    expect(processed.find(c => c.courseNumber === "7,850,2.00").credits).toBe(0);
  });
});
