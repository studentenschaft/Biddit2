import { useRecoilValue } from "recoil";
import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
// Updated imports to use unified course data selectors
import {
  availableCoursesSelector,
  selectedSemesterSelector,
  semesterMetadataSelector,
} from "../recoil/unifiedCourseDataSelectors";
import { mainProgramSelector } from "../recoil/unifiedAcademicDataSelectors";
import { currentEnrollmentsState } from "../recoil/currentEnrollmentsAtom";
import { apiClient } from "../helpers/axiosClient";
import { authTokenState } from "../recoil/authAtom";
import { unifiedAcademicDataState } from "../recoil/unifiedAcademicDataAtom";
import { LockOpen } from "../leftCol/bottomRow/LockOpen";
import { LockClosed } from "../leftCol/bottomRow/LockClosed";
import LoadingText from "../common/LoadingText";

// Import error handling service
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";
import { useUnifiedCourseData } from "../helpers/useUnifiedCourseData";
import { useScorecardFetching } from "../helpers/useScorecardFetching";

export default function SimilarCourses({ selectedCourse }) {
  const authToken = useRecoilValue(authTokenState);
  const scorecardFetching = useScorecardFetching();

  // Use unified course data selectors instead of old atoms
  const currentEnrollments = useRecoilValue(currentEnrollmentsState);
  const mainProgram = useRecoilValue(mainProgramSelector);
  const academicData = useRecoilValue(unifiedAcademicDataState);
  const selectedSemesterShortName = useRecoilValue(selectedSemesterSelector);

  // Get metadata for the selected semester
  const semesterMetadata = useRecoilValue(
    semesterMetadataSelector(selectedSemesterShortName)
  );

  const [, setRelevantCourseInfoForUpsert] = useState([]); // Keep for potential future use when upsert is re-enabled
  const [similarCourses, setSimilarCourses] = useState([]);

  // Use metadata from unified system instead of separate atoms
  const isFutureSemesterSelectedState =
    semesterMetadata?.isFutureSemester || false;
  const referenceSemesterState = semesterMetadata?.referenceSemester;
  const [referenceSemesterLocalState, setReferenceSemesterLocalState] =
    useState(null);

  // Compute effective semester for API calls: use reference semester if future, otherwise selected
  const effectiveSemesterShortName =
    referenceSemesterLocalState || selectedSemesterShortName || null;

  // For course lookups and display, always use the real selected semester (not reference)
  const coursesCurrentSemester = useRecoilValue(
    availableCoursesSelector(selectedSemesterShortName)
  );

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLong] = useState(false); // Keep for when upsert is re-enabled
  // Allow setting the current CourseInfo when user clicks a similar course title
  const { updateSelectedCourseInfo } = useUnifiedCourseData();

  // Derive program from unified data with robust fallbacks
  const derivedProgram =
    mainProgram?.metadata?.programDescription ||
    mainProgram?.programName ||
    currentEnrollments?.enrollmentInfos?.find((e) => e.isMainStudy)
      ?.studyProgramDescription ||
    (academicData?.programs
      ? Object.keys(academicData.programs)[0]
      : null) ||
    null;

  // Keep latest program value available inside async handlers
  const programRef = useRef(derivedProgram);
  useEffect(() => {
    programRef.current = derivedProgram;
  }, [derivedProgram]);

  // handle future semester selected
  // set true reference semester if future semester selected
  useEffect(() => {
    try {
      if (isFutureSemesterSelectedState) {
        // referenceSemester is already a shortName string in unified state
        setReferenceSemesterLocalState(referenceSemesterState || null);
      } else {
        setReferenceSemesterLocalState(null);
      }
    } catch (error) {
      console.error(
        "Error setting reference semester local state in similarCourses:",
        error
      );
      errorHandlingService.handleError(error);
    }
  }, [isFutureSemesterSelectedState, referenceSemesterState]);

  // set courses of current semester based on selected semester (always use real semester, not reference)
  // Note: coursesCurrentSemester is now directly loaded from unified selector using selectedSemesterShortName
  // This ensures we display courses from the actual selected semester, even if it's a future semester

  useEffect(() => {
    try {
      if (!coursesCurrentSemester) return;
      const relevantData = coursesCurrentSemester
        .map((course) => {
          if (!course.courseNumber) {
            console.warn("Missing course number for course:", course); // filter out missing courseNumbers, this was the case FS25 before bidding start
            return null;
          }
          return {
            courseNumber: course.courseNumber,
            shortName: course.shortName,
            classification: course.classification,
            courseContent: course.courseContent,
          };
        })
        .filter((course) => course !== null); // filter out missing courseNumbers, this was the case FS25 before bidding start
      setRelevantCourseInfoForUpsert(relevantData);
    } catch (error) {
      console.error(
        "Error setting relevant course info for upsert in similarCourses:",
        error
      );
      errorHandlingService.handleError(error);
    }
  }, [coursesCurrentSemester]);
  // TODO: Reintroduce once logs are showing and we can verify that correct data will be uploaded (once new semester data is published that is not yet in backend)
  // DISABLED: Upsert mechanism commented out until tested by Quality Control
  /*
  async function upsertRelevantCourseInfo(relevantCourseInfoForUpsert) {
    setIsLoadingLong(true);

    // might be better to clean up the course descriptions before upsert, database reset advised when applied (breaks filter out identical courses)
    // courseDescription: course.courseContent
    //           ? course.courseContent
    //               .replace(/<[^>]+>/g, "") // Remove HTML tags
    //               .replace(/\s+/g, " ") // Replace multiple spaces with a single space
    //               .trim() // Trim leading and trailing spaces
    //           : "",

    try {
      await axios.post(
        "https://api.shsg.ch/similar-courses/upsert",
        {
          courses: relevantCourseInfoForUpsert.map((course) => ({
            courseNumber: course.courseNumber,
            semester: referenceSemesterLocalState
              ? referenceSemesterLocalState
              : selectedSemesterShortName,
            courseDescription: course.courseContent,
            category: course.classification,
            program: program,
          })),
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
    } catch (error) {
      console.error("Error adding courses:", error);
      errorHandlingService.handleError(error);
    }
  }
  */
  // if button is clicked, fetch similar courses
  async function fetchSimilarCourses(
    selectedCourse,
    category = null,
    attemptedUpsert = false
  ) {
    setIsLoading(true);
    // Make sure program/scorecard data is available
    if (programRef.current === null && authToken) {
      try {
        const result = await scorecardFetching.fetchAll(authToken);
        const keys = result?.data ? Object.keys(result.data) : [];
        if (keys.length > 0) {
          programRef.current = keys[0];
        }
      } catch (e) {
        console.error("Failed to prefetch scorecard data:", e);
      }
    }

    if (programRef.current !== null) {
      try {
        if (!selectedCourse.courseContent) {
          console.error("Course content is missing");
          setIsLoading(false);
          return;
        }

        // Always use selected semester, or its reference when projected
        const semesterToUse = effectiveSemesterShortName;
        if (!semesterToUse) {
          console.warn(
            "No semester is selected or available for SimilarCourses query"
          );
          setIsLoading(false);
          return;
        }

        // // might be better to clean up the course descriptions before upsert, database reset advised when applied
        // // Clean up the course description
        // const cleanedCourseDescription = selectedCourse.courseContent
        //   .replace(/<[^>]+>/g, "") // Remove HTML tags
        //   .replace(/\s+/g, " ") // Replace multiple spaces with a single space
        //   .trim(); // Trim leading and trailing spaces

        const response = await apiClient.get(
          "https://api.shsg.ch/similar-courses/query",
          authToken,
          {
            params: {
              courseDescription: selectedCourse.courseContent,
              numberOfResults: 10,
              category: category,
              program: programRef.current,
              semester: semesterToUse,
            },
          }
        );

        setSimilarCourses(response.data);
        console.log("Similar courses:", response.data);
        setIsLoading(false);

        // Only attempt upsert once to prevent infinite recursion
        if (
          response.data.ids &&
          response.data.ids[0] &&
          response.data.ids[0].length === 0 &&
          !attemptedUpsert
        ) {
          // DISABLED: Upsert mechanism commented out until tested by Quality Control
          console.log(
            "No similar courses found - upsert mechanism disabled for quality control testing"
          );
          /*
        setIsLoadingLong(true);
        await upsertRelevantCourseInfo(relevantCourseInfoForUpsert);
        setIsLoadingLong(false);
        // Pass true to indicate we've already attempted an upsert
        fetchSimilarCourses(selectedCourse, category, true);
        */
        }
      } catch (error) {
        console.error("Error querying database:", error);
        if (error.response && error.response.status === 404) {
          console.log("No courses found, attempting upsert");
          if (!attemptedUpsert) {
            // DISABLED: Upsert mechanism commented out until tested by Quality Control
            console.log(
              "Upsert mechanism disabled for quality control testing"
            );
            /*
          setIsLoadingLong(true);
          await upsertRelevantCourseInfo(relevantCourseInfoForUpsert);
          setIsLoadingLong(false);
          fetchSimilarCourses(selectedCourse, category, true);
          */
            // For now, just set empty results
            setSimilarCourses({ ids: [[]], distances: [[]], metadatas: [[]] });
          } else {
            setSimilarCourses({ ids: [[]], distances: [[]], metadatas: [[]] });
          }
        } else {
          errorHandlingService.handleError(error);
        }
        setIsLoading(false);
      }
    } else {
      console.log("Program not yet loaded; will retry shortly");
      setTimeout(() => {
        fetchSimilarCourses(selectedCourse, category, attemptedUpsert);
      }, 800);
    }
  }

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [creditsFilter, setCreditsFilter] = useState("all");

  const filteredCourses = similarCourses.ids
    ? similarCourses.ids[0].filter((id) => {
        const course = coursesCurrentSemester.find(
          (course) => course.courseNumber === id.replace(/[A-Z]+\d+/g, "")
        );
        if (!course) return false;

        const categoryMatch =
          categoryFilter === "all" || categoryFilter === course.classification; // Use local classification instead of API category

        const creditsMatch =
          creditsFilter === "all" ||
          creditsFilter === (course.credits / 100).toFixed(2);

        return categoryMatch && creditsMatch;
      })
    : [];

  // console.log("filteredCourses", filteredCourses);

  // reset filter, similarCourses, Courses to display when new course selected
  useEffect(() => {
    setCategoryFilter("all");
    setCreditsFilter("all");
    setSimilarCourses([]);
  }, [selectedCourse]);

  // dynamically render colors based on course status and lock status
  const [lockedCourses, setLockedCourses] = useState([]);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [overlappingCourses, setOverlappingCourses] = useState([]);

  useEffect(() => {
    //bugfix: 25.04.25 undefined is not an object (evaluating 'X.courseNumber')
    if (!coursesCurrentSemester) return;

    const locked = coursesCurrentSemester
      .filter((course) => course.enrolled && course.courseNumber)
      .map((course) => course.courseNumber);
    setLockedCourses(locked);

    const selected = coursesCurrentSemester
      .filter((course) => course.selected && course.courseNumber)
      .map((course) => course.courseNumber);
    setSelectedCourses(selected);

    const overlapping = coursesCurrentSemester
      .filter((course) => course.overlapping && course.courseNumber)
      .map((course) => course.courseNumber);
    setOverlappingCourses(overlapping);
  }, [coursesCurrentSemester]);

  function isLocked(course) {
    return course.courseNumber && lockedCourses.includes(course.courseNumber);
  }

  function isSelected(course) {
    return course.courseNumber && selectedCourses.includes(course.courseNumber);
  }

  function isOverlapping(course) {
    return (
      course.courseNumber && overlappingCourses.includes(course.courseNumber)
    );
  }

  useEffect(() => {
    if (!similarCourses.ids) return;

    const filteredIds = [];
    const filteredDistances = [];
    const filteredMetadatas = [];

    similarCourses.ids[0].forEach((id, index) => {
      const distance = similarCourses.distances[0][index];
      if (distance > 0.01) {
        filteredIds.push(id);
        filteredDistances.push(distance);
        filteredMetadatas.push(similarCourses.metadatas[0][index]);
      } else {
        console.log("Removed course due to low similarity:", id);
        console.log("Distance:", distance);
      }
    });

    setSimilarCourses((prevSimilarCourses) => {
      if (
        JSON.stringify(prevSimilarCourses.ids) !==
          JSON.stringify([filteredIds]) ||
        JSON.stringify(prevSimilarCourses.distances) !==
          JSON.stringify([filteredDistances]) ||
        JSON.stringify(prevSimilarCourses.metadatas) !==
          JSON.stringify([filteredMetadatas])
      ) {
        return {
          ids: [filteredIds],
          distances: [filteredDistances],
          metadatas: [filteredMetadatas],
        };
      }
      return prevSimilarCourses;
    });
  }, [similarCourses.ids, similarCourses.distances, similarCourses.metadatas]);

  return (
    <>
      <div className="flex items-end gap-4">
        <button
          className="w-fit h-fit  bg-green-800 hover:bg-gray-400 text-white lg:font-semibold lg:text-md md:text-sm py-2 px-4 rounded mt-4"
          onClick={() => fetchSimilarCourses(selectedCourse)}
        >
          Search for similar courses
        </button>
        <div className="mt-4">
          <label
            htmlFor="categoryFilter"
            className="block text-sm font-medium text-gray-700"
          >
            Filter by Category:
          </label>
          <select
            id="categoryFilter"
            name="categoryFilter"
            className="w-fit pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none  focus:ring-green-700 focus:border-green-700 sm:text-sm rounded-md"
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option className="focus:selection:bg-green-500" value="all">
              All
            </option>
            {[
              ...new Set(
                similarCourses.ids?.[0]
                  .map((id) => {
                    const course = coursesCurrentSemester.find(
                      (course) =>
                        course.courseNumber === id.replace(/[A-Z]+\d+/g, "")
                    );
                    return course ? course.classification : null;
                  })
                  .filter((category) => category !== null)
              ),
            ]
              .sort()
              .map((category, index) => (
                <option key={index} value={category}>
                  {category}
                </option>
              ))}
          </select>
        </div>
        <div className="mt-4">
          <label
            htmlFor="creditsFilter"
            className="block text-sm font-medium text-gray-700"
          >
            Filter by Credits:
          </label>
          <select
            id="creditsFilter"
            name="creditsFilter"
            className="w-fit pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-700 focus:border-green-700 sm:text-sm rounded-md"
            onChange={(e) => setCreditsFilter(e.target.value)}
          >
            <option value="all">All</option>
            {[
              ...new Set(
                similarCourses.ids?.[0]
                  .map((id) => {
                    const course = coursesCurrentSemester.find(
                      (course) =>
                        course.courseNumber === id.replace(/[A-Z]+\d+/g, "")
                    );
                    return course ? (course.credits / 100).toFixed(2) : null;
                  })
                  .filter((credits) => credits !== null)
              ),
            ]
              .sort()
              .map((credits, index) => (
                <option key={index} value={credits}>
                  {credits}
                </option>
              ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center">
          <br />
          <LoadingText>Loading similar courses...</LoadingText>
        </div>
      ) : isLoadingLong ? (
        <div className="text-center">
          <br />
          <LoadingText>
            Embedding your course descriptions this initial process can take a
            while...
          </LoadingText>
          <br />
          <p>
            Please leave this tab open and come back in a few minutes. This will
            only happen once.
          </p>
        </div>
      ) : null}

      {filteredCourses.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 mt-4">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium tex</div>t-gray-500 uppercase tracking-wider"
                ></th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Course
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Category
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Credits
                </th>

                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Similarity Rank
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCourses
                .sort((a, b) => {
                  const distanceA =
                    similarCourses.distances[0][filteredCourses.indexOf(a)];
                  const distanceB =
                    similarCourses.distances[0][filteredCourses.indexOf(b)];
                  return distanceA - distanceB;
                })
                .map((id) => (
                  <tr key={id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {(() => {
                        const course = coursesCurrentSemester.find(
                          (course) =>
                            course.courseNumber === id.replace(/[A-Z]+\d+/g, "")
                        );
                        return course && isLocked(course) ? (
                          <LockClosed
                            clg={`w-4 h-4 text-green-800 cursor-not-allowed ${
                              isOverlapping(course) ? "text-orange-400" : ""
                            }`}
                          />
                        ) : (
                          <LockOpen
                            clg={`w-4 h-4 ${
                              isOverlapping(course)
                                ? "text-orange-400"
                                : isSelected(course)
                                ? "text-green-800"
                                : "hover:text-green-600"
                            }`}
                            event={course}
                            onClick={() => {
                              const updatedSelectedCourses = isSelected(course)
                                ? selectedCourses.filter(
                                    (c) => c !== course.courseNumber
                                  )
                                : [...selectedCourses, course.courseNumber];
                              setSelectedCourses(updatedSelectedCourses);
                            }}
                          />
                        );
                      })()}
                    </td>
                    <td
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 overflow-hidden overflow-ellipsis cursor-pointer hover:underline"
                      style={{ maxWidth: "450px" }}
                      onClick={() => {
                        const course = coursesCurrentSemester.find(
                          (c) => c.courseNumber === id.replace(/[A-Z]+\d+/g, "")
                        );
                        if (course) updateSelectedCourseInfo(course);
                      }}
                      title="Show course details"
                    >
                      {(
                        coursesCurrentSemester.find(
                          (course) =>
                            course.courseNumber === id.replace(/[A-Z]+\d+/g, "")
                        ) || {}
                      ).shortName || "N/A"}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(
                        coursesCurrentSemester.find(
                          (course) =>
                            course.courseNumber === id.replace(/[A-Z]+\d+/g, "")
                        ) || {}
                      ).classification || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(
                        (
                          coursesCurrentSemester.find(
                            (course) =>
                              course.courseNumber ===
                              id.replace(/[A-Z]+\d+/g, "")
                          ) || {}
                        ).credits / 100
                      ).toFixed(2) || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {similarCourses.ids[0].indexOf(id) + 1}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center mt-4">
          <p></p>
          {/* TODO: find a way to display this if response empty after fetch and upsert with refetch --> <p>No similar courses found</p> */}
        </div>
      )}
    </>
  );
}

export { SimilarCourses };

SimilarCourses.propTypes = {
  selectedCourse: PropTypes.object.isRequired,
};
