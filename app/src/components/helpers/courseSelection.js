// helpers/courseSelection.js
import { saveCourse, deleteCourse } from "./api";
import { parseSemester } from "./transformScorecard";


export async function processCourseSelection({
  course,
  authToken,
  selectedCourseIds,
  setSelectedCourseIds,
  localSelectedUpdate,
  currentStudyPlanId,
}) {
  if (!authToken) {
    console.error("No auth token available");
    return;
  }

  // Execute component-specific local state update logic
  await localSelectedUpdate(course);

  try {
    // checking both old (course.id) and new (course.courseNumber) course identification formats for saved courses
    const isCourseSelected = selectedCourseIds.includes(course.id) || selectedCourseIds.includes(course.courseNumber);

    if (isCourseSelected) {
      setSelectedCourseIds((prevIds) =>
        prevIds.filter((id) => id !== course.id && id !== course.courseNumber)
      );
      await deleteCourse(currentStudyPlanId, course.courseNumber, authToken); 
      console.log(`Course ${course.courseNumber} deleted from backend`);
    } else {
      setSelectedCourseIds((prevIds) => [...prevIds, course.courseNumber]); 
      await saveCourse(currentStudyPlanId, course.courseNumber, authToken); 
      console.log(`Course ${course.courseNumber} saved to backend`);
    }
  } catch (error) {
    console.error("Error updating course:", error);
  }
}

  
  const compareSemesters = (a, b) => {
    const semA = parseSemester(a);
    const semB = parseSemester(b);
    
    if (!semA || !semB) return 0;
    if (semA.year !== semB.year) return semA.year - semB.year;
    return semA.sem - semB.sem;
  };


  export const normalizeSemesterName = (name) => {
        if (!name) return "";
        
        // First, handle the case where there's a space between HS/FS and the number
        // Examples: "HS 25", "FS 26", "HS 25 - Placeholder"
        const spaceMatch = name.match(/(HS|FS)\s*(\d{2})/);
        if (spaceMatch) {
            return `${spaceMatch[1]}${spaceMatch[2]}`;
        }
        
        // Then handle the case where there's no space
        // Examples: "HS25", "FS26"
        const noSpaceMatch = name.match(/(HS|FS)(\d{2})/);
        if (noSpaceMatch) {
            return `${noSpaceMatch[1]}${noSpaceMatch[2]}`;
        }
        
        // Return original if no match
        return name;
    };

  
    export const findStudyPlanBySemester = (studyPlansData, cisId, semesterName, currentSemesterName) => {
        const normalizedTarget = normalizeSemesterName(semesterName);
        const currentSem = normalizeSemesterName(currentSemesterName);
        
        // If selected semester is in the future compared to current semester,
        // use name matching
        if (compareSemesters(normalizedTarget, currentSem) > 0) {

          // if match: console log, then return
          if (studyPlansData.some(plan => normalizeSemesterName(plan.id) === normalizedTarget)) {
          }
          return studyPlansData.find(plan => 
            normalizeSemesterName(plan.id) === normalizedTarget
          );
        }
        
        // For current/past semesters, try cisId first
        return studyPlansData.find(plan => plan.id === cisId) ||
               studyPlansData.find(plan => 
                 normalizeSemesterName(plan.id) === normalizedTarget
               );
      };