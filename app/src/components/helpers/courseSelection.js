// helpers/courseSelection.js

/**
 * Reduces the many spellings of a semester to the canonical "HS25" form.
 * Study plans are keyed by this value, so it is what API calls must send.
 * Handles "HS 25", "HS25" and suffixed variants like "HS 25 - Placeholder".
 */
export const normalizeSemesterName = (name) => {
  if (!name) return "";

  const spaceMatch = name.match(/(HS|FS)\s*(\d{2})/);
  if (spaceMatch) {
    return `${spaceMatch[1]}${spaceMatch[2]}`;
  }

  const noSpaceMatch = name.match(/(HS|FS)(\d{2})/);
  if (noSpaceMatch) {
    return `${noSpaceMatch[1]}${noSpaceMatch[2]}`;
  }

  return name;
};
