// collection of Regular Expressions (RegEx) // regEx.js


export const exerciseGroupRegex = new RegExp(
  [
    // Standard exercise group markers must also contain an explicit group indicator
    "^(?=.*(?:Exercises?|Übungen?|Exercisegroup|Übungsgruppe))(?=.*(?:Gruppe|Group)\\s*[\\p{L}\\p{N}]+).+",
    // Case Studies / Fallstudien with an explicit group indicator
    "^(?=.*(?:Case Stud(?:y|ies)|Fallstudien?))(?=.*(?:Gruppe|Group)\\s*[\\p{L}\\p{N}]+).+",
    // Titles that clearly denote an exercise subgroup through a suffix
    "\\bExercisegroup\\b",
    "\\bÜbungsgruppe\\b",
    "(?::\\s*(?:Exercises?|Übungen?)\\b)",
    "(?::\\s*(?:Case Stud(?:y|ies)|Fallstudien?)\\b)",
    // Coaching subgroup patterns (avoid matching proper courses like 'Mathe-Coaching')
    // 1) Title suffix like ': Coaching' or ': Coaching 1'
    "(?::\\s*Coaching(?:\\s*\\d+)?\\s*$)",
    // 2) 'Coaching Group 1' or 'Coaching Gruppe 1' at the end
    "\\bCoaching\\s*(?:Gruppe|Group)\\s*[\\p{L}\\p{N}]+\\s*$"
  ].join("|"),
  "iu"
);
