import { useMemo } from "react";
import { useRecoilValue } from "recoil";
import { 
  academicProgressSelector,
  mainProgramStudyPlanSelector 
} from "../recoil/unifiedAcademicDataSelectors";
import { removeSpacesFromSemesterName, isSemesterInPast } from "./studyOverviewHelpers";

/**
 * Hook for calculating and managing academic progress
 * Provides computed progress metrics and helper functions
 */
export function useAcademicProgress(currentSemester) {
  const academicProgress = useRecoilValue(academicProgressSelector);
  const studyPlan = useRecoilValue(mainProgramStudyPlanSelector);

  /**
   * Calculate semester-level statistics
   */
  const semesterStats = useMemo(() => {
    if (!studyPlan || !currentSemester) return {};

    const stats = {};
    
    Object.entries(studyPlan).forEach(([semesterKey, courses]) => {
      if (!courses || courses.length === 0) return;

      // Filter out wishlist courses for past semesters
      const isPast = isSemesterInPast(
        removeSpacesFromSemesterName(semesterKey),
        removeSpacesFromSemesterName(currentSemester)
      );
      
      const filteredCourses = isPast 
        ? courses.filter(course => !course.type?.endsWith('-wishlist'))
        : courses;

      // Calculate credits and grades
      let totalCredits = 0;
      let completedCredits = 0;
      let plannedCredits = 0;
      let gradeSum = 0;
      let gradedCourses = 0;

      filteredCourses.forEach(course => {
        const credits = course.credits || 0;
        totalCredits += credits;

        if (course.grade && typeof course.grade === 'number') {
          completedCredits += credits;
          gradeSum += course.grade * credits; // Weight by credits
          gradedCourses++;
        } else if (course.type?.endsWith('-wishlist')) {
          plannedCredits += credits;
        }
      });

      const averageGrade = completedCredits > 0 ? gradeSum / completedCredits : null;
      const isOverloaded = totalCredits > 30;

      stats[semesterKey] = {
        totalCredits,
        completedCredits,
        plannedCredits,
        averageGrade,
        isOverloaded,
        courseCount: filteredCourses.length,
        completedCourseCount: gradedCourses
      };
    });

    return stats;
  }, [studyPlan, currentSemester]);

  /**
   * Calculate overall program statistics
   */
  const programStats = useMemo(() => {
    const semesterValues = Object.values(semesterStats);
    
    if (semesterValues.length === 0) {
      return {
        totalCreditsEarned: 0,
        totalCreditsPlanned: 0,
        overallGPA: null,
        semesterCount: 0,
        overloadedSemesters: 0
      };
    }

    let totalCreditsEarned = 0;
    let totalCreditsPlanned = 0;
    let totalGradePoints = 0;
    let totalGradedCredits = 0;
    let overloadedSemesters = 0;

    semesterValues.forEach(stats => {
      totalCreditsEarned += stats.completedCredits;
      totalCreditsPlanned += stats.plannedCredits;
      
      if (stats.averageGrade && stats.completedCredits > 0) {
        totalGradePoints += stats.averageGrade * stats.completedCredits;
        totalGradedCredits += stats.completedCredits;
      }
      
      if (stats.isOverloaded) {
        overloadedSemesters++;
      }
    });

    const overallGPA = totalGradedCredits > 0 ? totalGradePoints / totalGradedCredits : null;

    return {
      totalCreditsEarned,
      totalCreditsPlanned,
      overallGPA,
      semesterCount: semesterValues.length,
      overloadedSemesters
    };
  }, [semesterStats]);

  /**
   * Get progress towards degree completion
   */
  const progressMetrics = useMemo(() => {
    const required = academicProgress.totalCreditsRequired || 180;
    const completed = academicProgress.totalCreditsCompleted || programStats.totalCreditsEarned;
    const planned = academicProgress.totalCreditsPlanned || programStats.totalCreditsPlanned;
    
    const totalProgress = completed + planned;
    const completionPercentage = required > 0 ? (completed / required) * 100 : 0;
    const progressWithPlanned = required > 0 ? (totalProgress / required) * 100 : 0;
    const remaining = Math.max(0, required - totalProgress);

    return {
      required,
      completed,
      planned,
      totalProgress,
      completionPercentage: Math.round(completionPercentage * 100) / 100,
      progressWithPlanned: Math.round(progressWithPlanned * 100) / 100,
      remaining,
      isNearCompletion: completionPercentage >= 80,
      isOnTrack: progressWithPlanned >= completionPercentage
    };
  }, [academicProgress, programStats]);

  /**
   * Get semester performance indicators
   */
  const getPerformanceIndicators = (semesterKey) => {
    const stats = semesterStats[semesterKey];
    if (!stats) return null;

    return {
      status: stats.averageGrade ? 
        (stats.averageGrade >= 4.0 ? 'good' : 'needs-attention') : 'in-progress',
      creditLoad: stats.isOverloaded ? 'high' : 'normal',
      completion: stats.completedCredits > 0 ? 'partial' : 'planned',
      riskFactors: [
        ...(stats.isOverloaded ? ['overloaded'] : []),
        ...(stats.averageGrade && stats.averageGrade < 4.0 ? ['low-grades'] : []),
        ...(stats.totalCredits < 20 ? ['under-enrolled'] : [])
      ]
    };
  };

  /**
   * Calculate time to graduation estimate
   */
  const graduationEstimate = useMemo(() => {
    const remaining = progressMetrics.remaining;
    const averagePerSemester = 30; // Typical course load
    const semestersRemaining = Math.ceil(remaining / averagePerSemester);
    
    // Simple semester progression (could be enhanced with actual calendar logic)
    const currentYear = new Date().getFullYear();
    const isSpring = currentSemester?.startsWith('FS');
    
    let estimatedYear = currentYear;
    let estimatedSemester = isSpring ? 'HS' : 'FS';
    
    for (let i = 0; i < semestersRemaining; i++) {
      if (estimatedSemester === 'FS') {
        estimatedSemester = 'HS';
      } else {
        estimatedSemester = 'FS';
        estimatedYear++;
      }
    }

    return {
      semestersRemaining,
      estimatedCompletion: semestersRemaining > 0 ? 
        `${estimatedSemester}${estimatedYear.toString().slice(-2)}` : 'Current',
      isOnSchedule: semestersRemaining <= 6 // Typical program length
    };
  }, [progressMetrics.remaining, currentSemester]);

  return {
    // Main metrics
    academicProgress,
    semesterStats,
    programStats,
    progressMetrics,
    graduationEstimate,
    
    // Helper functions
    getPerformanceIndicators,
    
    // Computed flags
    isLoading: !studyPlan,
    hasData: Object.keys(semesterStats).length > 0
  };
}