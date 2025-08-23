import { exerciseGroupRegex } from "./regEx";

export const extractBaseName = (courseName) => {
  if (!courseName || typeof courseName !== 'string') {
    return '';
  }
  
  return courseName
    .replace(/\s*(Exercises?|Übungen?|Exercisegroup|Übungsgruppe)\s*\d*\s*/gi, '')
    .replace(/\s*(Gruppe?|Group)\s*\d*\s*/gi, '')
    .replace(/\s*\d+\s*$/, '')
    .replace(/\s*[,-]\s*$/, '')
    .trim();
};

export const isExerciseGroup = (course) => {
  if (!course) return false;
  
  const courseName = course.name || course.shortName || course.description || '';
  return exerciseGroupRegex.test(courseName);
};

export const groupCoursesByBaseName = (courses) => {
  if (!Array.isArray(courses)) {
    return new Map();
  }
  
  const groups = new Map();
  
  courses.forEach(course => {
    const courseName = course.name || course.shortName || course.description || '';
    const baseName = extractBaseName(courseName);
    
    if (baseName) {
      if (!groups.has(baseName)) {
        groups.set(baseName, []);
      }
      groups.get(baseName).push(course);
    }
  });
  
  return groups;
};

export const hasMainCourse = (courseGroup) => {
  if (!Array.isArray(courseGroup)) {
    return false;
  }
  
  return courseGroup.some(course => !isExerciseGroup(course));
};

const createCourseIdentifier = (course) => {
  return course.id || 
         course.hierarchy || 
         course.name || 
         course.shortName || 
         course.description || 
         '';
};

export const processExerciseGroupECTS = (courses) => {
  if (!courses || !Array.isArray(courses)) {
    return courses || [];
  }
  
  const courseGroups = groupCoursesByBaseName(courses);
  const shouldZeroECTS = new Set();
  
  courseGroups.forEach((courseGroup) => {
    // Only zero exercise groups when main course exists in same group
    if (courseGroup.length > 1 && hasMainCourse(courseGroup)) {
      courseGroup.forEach(course => {
        if (isExerciseGroup(course)) {
          const identifier = createCourseIdentifier(course);
          if (identifier) {
            shouldZeroECTS.add(identifier);
          }
        }
      });
    }
  });
  
  return courses.map(course => {
    const identifier = createCourseIdentifier(course);
    
    if (isExerciseGroup(course) && shouldZeroECTS.has(identifier)) {
      return { ...course, credits: 0 };
    }
    
    return { ...course };
  });
};

export const calculateSmartSemesterCredits = (courses) => {
  const processedCourses = processExerciseGroupECTS(courses);
  
  return processedCourses.reduce((sum, course) => {
    const credits = parseFloat(course.credits || course.sumOfCredits) || 0;
    return sum + credits;
  }, 0);
};

export const getProcessingMetadata = (courses) => {
  if (!Array.isArray(courses)) {
    return {
      totalProcessed: 0,
      exerciseGroupsZeroed: 0,
      standaloneExerciseGroupsPreserved: 0,
      courseGroups: 0
    };
  }
  
  const processedCourses = processExerciseGroupECTS(courses);
  const courseGroups = groupCoursesByBaseName(courses);
  
  let exerciseGroupsZeroed = 0;
  let standaloneExerciseGroupsPreserved = 0;
  
  courses.forEach((originalCourse, index) => {
    const processedCourse = processedCourses[index];
    
    if (isExerciseGroup(originalCourse)) {
      if (processedCourse.credits === 0 && originalCourse.credits > 0) {
        exerciseGroupsZeroed++;
      } else if (processedCourse.credits > 0) {
        standaloneExerciseGroupsPreserved++;
      }
    }
  });
  
  return {
    totalProcessed: courses.length,
    exerciseGroupsZeroed,
    standaloneExerciseGroupsPreserved,
    courseGroups: courseGroups.size
  };
};