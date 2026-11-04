import { describe, it, expect } from 'vitest';
import { _testHelpers } from '../../curriculumMapSelector';
import MBI from '../../../testing/mockData/Scorecard_MBI.json';
import BBWL from '../../../testing/mockData/Scorecard_BBWL.json';
import BIA from '../../../testing/mockData/Scorecard_BIA.json';
import BSC from '../../../testing/mockData/Scorecard_BSC.json';

const { extractClassifications } = _testHelpers;

const collectTitleNames = (items, names) => {
  (items || []).forEach((item) => {
    if (!item.isTitle) return;
    names.add(item.description || item.shortName);
    collectTitleNames(item.items, names);
  });
  return names;
};

const scorecardNames = [MBI, BBWL, BIA, BSC].reduce(
  (names, scorecard) => collectTitleNames(scorecard.items, names),
  new Set(),
);

// Category names the selector test builds inline, beyond the scorecard fixtures.
const inlineNames = [
  'Compulsory',
  'COMPULSORY',
  'Core',
  'Elective',
  'Elective Courses',
  'Electives',
  'Thesis',
  'Master Thesis',
  'Wahlpflicht',
  'Focus Area',
  'Core Research Methods',
  'Handlungskompetenzen',
  'Reflection Competences',
  'Basic Courses',
  'Advanced Courses',
  'Seminare',
  'MacFin',
  'Category',
  'Program',
  'Random Unknown Category',
];

const classify = (names) =>
  Object.fromEntries(
    names.map((name) => [
      name,
      extractClassifications({ description: name }).join(', '),
    ]),
  );

describe('category patterns', () => {
  it('classifies every scorecard fixture category as before', () => {
    expect(classify([...scorecardNames])).toMatchInlineSnapshot(`
      {
        "Area of Concentration": "focus, schwerpunkt, Focus Area, Major, Concentration, Schwerpunktfächer",
        "Bachelor of Arts in Business Administration": "",
        "Bachelor of Arts in International Affairs": "",
        "Bachelor of Science in Computer Science": "",
        "Bachelor´s Thesis (Title in original language)": "thesis, masterarbeit, bachelorarbeit, Thesis, Master Thesis, Bachelor Thesis",
        "Compulsory Subjects": "compulsory, pflicht, Pflichtbereich, mandatory, Pflicht",
        "Computer Science electives": "elective, wahl, Wahlbereich, Elective, Wahl",
        "Contextual Studies": "context, kontext, Contextual Studies, Kontextstudium",
        "Core Electives": "core, kern, Core, Foundation, Kernbereich, elective, wahl, Wahlbereich, Elective, Wahl",
        "Core Electives and Electives": "core, kern, Core, Foundation, Kernbereich, elective, wahl, Wahlbereich, Elective, Wahl",
        "Core Studies": "core, kern, Core, Foundation, Kernbereich",
        "Electives": "elective, wahl, Wahlbereich, Elective, Wahl",
        "Global Challenges": "",
        "Integrated Fundamentals": "",
        "Languages": "",
        "Law, Management and Economics for Computer Scientists": "",
        "Master of Arts in Business Innovation": "",
        "Master´s Thesis (Title in original language)": "thesis, masterarbeit, bachelorarbeit, Thesis, Master Thesis, Bachelor Thesis",
        "Method Course": "method, forschung, Research Methods, Forschungsmethoden",
        "Research, Practice, Ventureprojects / Issue Coverage": "method, forschung, Research Methods, Forschungsmethoden, project, projekt, Projects, Projekte",
        "Skills": "skills, Skills, kompetenz, Kompetenz, Handlungskompetenz, Competences",
        "Skills and Languages": "skills, Skills, kompetenz, Kompetenz, Handlungskompetenz, Competences",
        "Spring Project": "project, projekt, Projects, Projekte",
      }
    `);
  });

  it('classifies the inline test category names as before', () => {
    expect(classify(inlineNames)).toMatchInlineSnapshot(`
      {
        "Advanced Courses": "",
        "Basic Courses": "",
        "COMPULSORY": "compulsory, pflicht, Pflichtbereich, mandatory, Pflicht",
        "Category": "",
        "Compulsory": "compulsory, pflicht, Pflichtbereich, mandatory, Pflicht",
        "Core": "core, kern, Core, Foundation, Kernbereich",
        "Core Research Methods": "method, forschung, Research Methods, Forschungsmethoden, core, kern, Core, Foundation, Kernbereich",
        "Elective": "elective, wahl, Wahlbereich, Elective, Wahl",
        "Elective Courses": "elective, wahl, Wahlbereich, Elective, Wahl",
        "Electives": "elective, wahl, Wahlbereich, Elective, Wahl",
        "Focus Area": "focus, schwerpunkt, Focus Area, Major, Concentration, Schwerpunktfächer",
        "Handlungskompetenzen": "skills, Skills, kompetenz, Kompetenz, Handlungskompetenz, Competences",
        "MacFin": "",
        "Master Thesis": "thesis, masterarbeit, bachelorarbeit, Thesis, Master Thesis, Bachelor Thesis",
        "Program": "",
        "Random Unknown Category": "",
        "Reflection Competences": "skills, Skills, kompetenz, Kompetenz, Handlungskompetenz, Competences",
        "Seminare": "seminar, Seminar, Seminare",
        "Thesis": "thesis, masterarbeit, bachelorarbeit, Thesis, Master Thesis, Bachelor Thesis",
        "Wahlpflicht": "compulsory, pflicht, Pflichtbereich, mandatory, Pflicht",
      }
    `);
  });

  it('reads the shortName when a category has no description', () => {
    expect(extractClassifications({ shortName: 'Seminare' })).toEqual(
      extractClassifications({ description: 'Seminare' }),
    );
  });
});
