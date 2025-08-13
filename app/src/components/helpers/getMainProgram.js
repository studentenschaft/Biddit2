/**
 * getMainProgram.js
 * 
 * Shared utility to determine the main program from academic data
 * Uses intelligent fallback strategy: explicit main -> Master/Bachelor -> first available
 */

/**
 * Gets the main program key from academic data using intelligent fallback strategy
 * @param {Object} academicData - Academic data from unifiedAcademicDataSelector
 * @returns {string|null} - Main program key or null if no programs
 */
export const getMainProgramKey = (academicData) => {
  if (!academicData?.programs) {
    return null;
  }
  
  const programEntries = Object.entries(academicData.programs);
  if (programEntries.length === 0) {
    return null;
  }
  
  // Strategy 1: Look for explicitly marked main program
  let selectedProgram = programEntries.find(([, programData]) => 
    programData?.metadata?.isMainStudy || 
    programData?.rawScorecard?.isMainStudy || 
    programData?.isMainProgram
  );
  
  if (selectedProgram) {
    return selectedProgram[0];
  }
  
  // Strategy 2: Prefer Master programs, then Bachelor programs
  selectedProgram = programEntries.find(([programId]) => 
    programId.toLowerCase().includes('master')
  );
  
  if (selectedProgram) {
    return selectedProgram[0];
  }
  
  selectedProgram = programEntries.find(([programId]) => 
    programId.toLowerCase().includes('bachelor')
  );
  
  if (selectedProgram) {
    return selectedProgram[0];
  }
  
  // Strategy 3: Use first available program
  return programEntries[0][0];
};

/**
 * Gets the main program data from academic data
 * @param {Object} academicData - Academic data from unifiedAcademicDataSelector
 * @returns {Object|null} - Main program data or null if not found
 */
export const getMainProgram = (academicData) => {
  const mainProgramKey = getMainProgramKey(academicData);
  return mainProgramKey ? academicData.programs[mainProgramKey] : null;
};

export default getMainProgramKey;