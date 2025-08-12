import { useRecoilState, useRecoilValue } from "recoil";
import { useState, useEffect, useRef, useMemo } from "react";
import { fetchScoreCardEnrollments } from "../recoil/ApiScorecardEnrollments";
import { scorecardEnrollmentsState } from "../recoil/scorecardEnrollmentsAtom";
import axios from "axios";
import { authTokenState } from "../recoil/authAtom";
// Use unified selected/current semester selectors instead of legacy atom
import {
  selectedSemesterSelector as unifiedSelectedSemesterSelector,
  availableCoursesSelector,
  semesterMetadataSelector,
} from "../recoil/unifiedCourseDataSelectors";
import { LockOpen } from "../leftCol/bottomRow/LockOpen";
import { LockClosed } from "../leftCol/bottomRow/LockClosed";
import LoadingText from "../common/LoadingText";
// Legacy future semester imports removed; using unified semesterMetadata instead

// Import error handling service
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";
// Imports for unified program derivation and CourseInfo selection
import { mainProgramSelector } from "../recoil/unifiedAcademicDataSelectors";
import { currentEnrollmentsState } from "../recoil/currentEnrollmentsAtom";
import { scorecardDataState } from "../recoil/scorecardsAllRawAtom";
// import { useUnifiedCourseData } from "../helpers/useUnifiedCourseData";
import { useScorecardFetching } from "../helpers/useScorecardFetching";

export default function SmartSearch() {
  const authToken = useRecoilValue(authTokenState);
  const [, setScoreCardEnrollments] = useRecoilState(scorecardEnrollmentsState);
  const scorecardFetching = useScorecardFetching();

  // Use new unified course data system for semester selection
  const unifiedSelectedSemesterShortName = useRecoilValue(
    unifiedSelectedSemesterSelector
  );
  // We'll compute effective semester after reference logic below
  // eslint-disable-next-line no-unused-vars
  const [relevantCourseInfoForUpsert, setRelevantCourseInfoForUpsert] =
    useState([]);
  const [similarCourses, setSimilarCourses] = useState([]);

  // Use unified semester metadata for future/reference semester handling
  const semesterMetadata = useRecoilValue(
    semesterMetadataSelector(unifiedSelectedSemesterShortName)
  );
  const isFutureSemesterSelectedSate = semesterMetadata?.isFutureSemester;
  const referenceSemesterState = semesterMetadata?.referenceSemester;
  const [referenceSemesterLocalState, setReferenceSemesterLocalState] =
    useState(null);
  // Determine the effective semester: selected semester or its reference if projected
  const effectiveSemesterShortName =
    referenceSemesterLocalState || unifiedSelectedSemesterShortName || null;

  // Retrieve available courses for the effective semester
  const coursesCurrentSemester = useRecoilValue(
    availableCoursesSelector(effectiveSemesterShortName)
  );

  const [isLoading, setIsLoading] = useState(false);
  // TEMPORARILY DISABLED UNTIL STABLE
  // eslint-disable-next-line no-unused-vars
  const [isLoadingLong, setIsLoadingLong] = useState(false);
  const [searchInput, setSearchInput] = useState("");

  // // Use unified course data to set CourseInfo when clicking a title
  // const { updateSelectedCourseInfo } = useUnifiedCourseData();

  // Unified program derivation with fallbacks
  const currentEnrollments = useRecoilValue(currentEnrollmentsState);
  const mainProgram = useRecoilValue(mainProgramSelector);
  const scorecardData = useRecoilValue(scorecardDataState);

  const derivedProgram =
    mainProgram?.metadata?.programDescription ||
    mainProgram?.programName ||
    currentEnrollments?.enrollmentInfos?.find((e) => e.isMainStudy)
      ?.studyProgramDescription ||
    (scorecardData?.rawScorecards
      ? Object.keys(scorecardData.rawScorecards)[0]
      : null) ||
    null;

  // needed for fetchSimilarCourses to have the most recent program value
  const programRef = useRef(derivedProgram);
  useEffect(() => {
    programRef.current = derivedProgram;
  }, [derivedProgram]);

  useEffect(() => {
    if (authToken) {
      const fetchEnrollments = async (retry = false) => {
        try {
          const data = await fetchScoreCardEnrollments(authToken);
          setScoreCardEnrollments(data);
        } catch (error) {
          console.error("Error fetching scorecard enrollments:", error);
          if (!retry) {
            setTimeout(() => fetchEnrollments(true), 1000);
          } else {
            errorHandlingService.handleError(error);
          }
        }
      };
      fetchEnrollments();
    }
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  // handle future semester selected
  useEffect(() => {
    try {
      if (isFutureSemesterSelectedSate) {
        // referenceSemester already stored as shortName
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
  }, [isFutureSemesterSelectedSate, referenceSemesterState]);

  // Process course data for upsert
  useEffect(() => {
    try {
      if (!coursesCurrentSemester) return;
      const relevantData = coursesCurrentSemester
        .map((course) => {
          if (!course.courses?.[0]?.courseNumber) {
            console.warn("Missing course number for course:", course);
            return null;
          }
          return {
            courseNumber: course.courses[0].courseNumber,
            shortName: course.shortName,
            classification: course.classification,
            courseContent: course.courseContent,
          };
        })
        .filter((course) => course !== null);
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
  // This feature is temporarily disabled until we have a stable version
  // eslint-disable-next-line no-unused-vars
  async function upsertRelevantCourseInfo(relevantCourseInfoForUpsert) {
    console.log(
      "Upsert functionality is currently disabled for stability reasons"
    );
    return; // Early return - function disabled

    /* COMMENTED OUT UNTIL STABLE
    setIsLoadingLong(true);

    try {
      await axios.post(
        "https://api.shsg.ch/similar-courses/upsert",
        {
          courses: relevantCourseInfoForUpsert.map((course) => ({
            courseNumber: course.courseNumber,
            semester: referenceSemesterLocalState
              ? referenceSemesterLocalState
              : selectedSemesterState,
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
    */
  }

  // fetch similar courses using search input
  async function fetchSimilarCourses(category = null, attemptedUpsert = false) {
    if (!searchInput.trim()) {
      return; // Don't search if input is empty
    }

    setIsLoading(true);
    // Ensure program/scorecard data is available before querying
    if (programRef.current === null) {
      // Try to derive from existing scorecard data
      const fallbackProgram = scorecardData?.rawScorecards
        ? Object.keys(scorecardData.rawScorecards)[0]
        : null;
      if (fallbackProgram) {
        programRef.current = fallbackProgram;
      } else if (authToken) {
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
    }

    if (programRef.current !== null) {
      try {
        const semesterToUse = effectiveSemesterShortName;
        if (!semesterToUse) {
          console.warn(
            "No semester is selected or available for SmartSearch query"
          );
          setIsLoading(false);
          return;
        }
        const response = await axios.get(
          "https://api.shsg.ch/similar-courses/query",
          {
            params: {
              courseDescription: searchInput,
              numberOfResults: 10,
              category: category,
              program: programRef.current,
              semester: semesterToUse,
            },
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        setSimilarCourses(response.data);
        console.log("Similar courses:", response.data);
        setIsLoading(false); // UPSERT DISABLED - Show message instead of attempting upsert
        if (
          response.data.ids &&
          response.data.ids[0] &&
          response.data.ids[0].length === 0 &&
          !attemptedUpsert
        ) {
          console.log(
            "No similar courses found. Upsert functionality is currently disabled."
          );
          setSimilarCourses({
            ids: [[]],
            distances: [[]],
            metadatas: [[]],
            message:
              "No similar courses found in database. Course embedding feature is temporarily disabled for stability.",
          });
          return;

          /* COMMENTED OUT UNTIL STABLE
          setIsLoadingLong(true);
          await upsertRelevantCourseInfo(relevantCourseInfoForUpsert);
          setIsLoadingLong(false);
          // Pass true to indicate we've already attempted an upsert
          fetchSimilarCourses(category, true);
          */
        }
      } catch (error) {
        console.error("Error querying database:", error);
        if (error.response && error.response.status === 404) {
          console.log(
            "No courses found (404 error). Upsert functionality is currently disabled."
          );
          if (!attemptedUpsert) {
            setSimilarCourses({
              ids: [[]],
              distances: [[]],
              metadatas: [[]],
              message:
                "No courses found in database. Course embedding feature is temporarily disabled for stability.",
            });
          } else {
            setSimilarCourses({ ids: [[]], distances: [[]], metadatas: [[]] });
          }

          /* COMMENTED OUT UNTIL STABLE
          if (!attemptedUpsert) {
            setIsLoadingLong(true);
            await upsertRelevantCourseInfo(relevantCourseInfoForUpsert);
            setIsLoadingLong(false);
            fetchSimilarCourses(category, true);
          } else {
            setSimilarCourses({ ids: [[]], distances: [[]], metadatas: [[]] });
          }
          */
        } else {
          errorHandlingService.handleError(error);
        }
        setIsLoading(false);
      }
    } else {
      console.log("Program not yet loaded; will retry shortly");
      setTimeout(() => {
        fetchSimilarCourses(category, attemptedUpsert);
      }, 800);
    }
  }

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [creditsFilter, setCreditsFilter] = useState("all");

  // Build stable option arrays for filters
  const categoryOptions = useMemo(() => {
    const ids = similarCourses?.ids?.[0] ?? [];
    const categories = ids
      .map((id) => {
        const course = coursesCurrentSemester?.find(
          (c) => c.courses?.[0]?.courseNumber === id.replace(/[A-Z]+\d+/g, "")
        );
        return course ? course.classification : null;
      })
      .filter((v) => v != null);
    return Array.from(new Set(categories)).sort();
  }, [similarCourses?.ids, coursesCurrentSemester]);

  const creditOptions = useMemo(() => {
    const ids = similarCourses?.ids?.[0] ?? [];
    const credits = ids
      .map((id) => {
        const course = coursesCurrentSemester?.find(
          (c) => c.courses?.[0]?.courseNumber === id.replace(/[A-Z]+\d+/g, "")
        );
        return course ? (course.credits / 100).toFixed(2) : null;
      })
      .filter((v) => v != null);
    return Array.from(new Set(credits)).sort();
  }, [similarCourses?.ids, coursesCurrentSemester]);

  const filteredCourses = similarCourses.ids
    ? similarCourses.ids[0].filter((id) => {
        const course = coursesCurrentSemester.find(
          (c) => c.courses?.[0]?.courseNumber === id.replace(/[A-Z]+\d+/g, "")
        );
        if (!course) return false;
        const categoryMatch =
          categoryFilter === "all" || categoryFilter === course.classification;
        const creditsMatch =
          creditsFilter === "all" ||
          creditsFilter === (course.credits / 100).toFixed(2);
        return categoryMatch && creditsMatch;
      })
    : [];

  console.log("filteredCourses", filteredCourses);

  // reset filter and similarCourses when search input changes
  useEffect(() => {
    setCategoryFilter("all");
    setCreditsFilter("all");
    setSimilarCourses([]);
  }, [searchInput]);

  // dynamically render colors based on course status and lock status
  const [lockedCourses, setLockedCourses] = useState([]);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [overlappingCourses, setOverlappingCourses] = useState([]);
  useEffect(() => {
    if (!coursesCurrentSemester) return;

    const locked = coursesCurrentSemester
      .filter((course) => course.enrolled && course.courses?.[0]?.courseNumber)
      .map((course) => course.courses[0].courseNumber);
    setLockedCourses(locked);

    const selected = coursesCurrentSemester
      .filter((course) => course.selected && course.courses?.[0]?.courseNumber)
      .map((course) => course.courses[0].courseNumber);
    setSelectedCourses(selected);

    const overlapping = coursesCurrentSemester
      .filter(
        (course) => course.overlapping && course.courses?.[0]?.courseNumber
      )
      .map((course) => course.courses[0].courseNumber);
    setOverlappingCourses(overlapping);
  }, [coursesCurrentSemester]);
  function isLocked(course) {
    return lockedCourses.includes(course.courses[0].courseNumber);
  }

  function isSelected(course) {
    return selectedCourses.includes(course.courses[0].courseNumber);
  }

  function isOverlapping(course) {
    return overlappingCourses.includes(course.courses[0].courseNumber);
  }

  useEffect(() => {
    if (!similarCourses.ids) return;
    // Only update state if the data has actually changed
    setSimilarCourses((prevSimilarCourses) => {
      if (
        JSON.stringify(prevSimilarCourses.ids) !==
          JSON.stringify(similarCourses.ids) ||
        JSON.stringify(prevSimilarCourses.distances) !==
          JSON.stringify(similarCourses.distances) ||
        JSON.stringify(prevSimilarCourses.metadatas) !==
          JSON.stringify(similarCourses.metadatas)
      ) {
        return {
          ids: similarCourses.ids,
          distances: similarCourses.distances,
          metadatas: similarCourses.metadatas,
        };
      }
      return prevSimilarCourses;
    });
  }, [similarCourses.ids, similarCourses.distances, similarCourses.metadatas]);

  const handleSearchInputChange = (e) => {
    setSearchInput(e.target.value);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      fetchSimilarCourses();
    }
  };

  return (
    <>
      <div className="mb-6 mt-5 bg-green-50 rounded-lg p-4 border-l-4 border-green-700">
        <h2 className="text-xl font-semibold text-green-800 flex items-center mb-2">
          <span className="mr-2">🔍</span> Smart Search
        </h2>
        <div className="text-sm text-gray-600 pl-2 border-l-2 border-green-200">
          <p className="mb-1">
            Find courses based on what they&apos;re really about!
          </p>
          <p className="mb-1">✨ Try descriptive phrases like:</p>
          <p className="font-medium pl-3 text-green-700">
            &quot;Programming basics&quot; • &quot;History and Asia&quot;
          </p>
        </div>
      </div>
      <div className="flex flex-col mb-4">
        <label
          htmlFor="searchInput"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Search for courses:
        </label>
        <div className="flex items-end gap-4">
          <input
            type="text"
            id="searchInput"
            value={searchInput}
            onChange={handleSearchInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Enter keywords to find similar courses"
            className="w-full pl-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-green-700 focus:border-green-700"
          />
          <button
            className="w-fit h-fit bg-green-800 hover:bg-gray-400 text-white lg:font-semibold lg:text-md md:text-sm py-2 px-4 rounded"
            onClick={() => fetchSimilarCourses()}
          >
            Search
          </button>
        </div>
      </div>

      <div className="flex items-end gap-4">
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
            value={categoryFilter}
          >
            <option className="focus:selection:bg-green-500" value="all">
              All
            </option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
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
            value={creditsFilter}
          >
            <option value="all">All</option>
            {creditOptions.map((credits) => (
              <option key={credits} value={credits}>
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
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
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
                  const ids = similarCourses?.ids?.[0] ?? [];
                  const dists = similarCourses?.distances?.[0] ?? [];
                  const idxA = ids.indexOf(a);
                  const idxB = ids.indexOf(b);
                  const distanceA =
                    idxA >= 0 ? dists[idxA] ?? Infinity : Infinity;
                  const distanceB =
                    idxB >= 0 ? dists[idxB] ?? Infinity : Infinity;
                  return distanceA - distanceB;
                })
                .map((id) => {
                  const course = coursesCurrentSemester.find(
                    (c) =>
                      c.courses?.[0]?.courseNumber ===
                      id.replace(/[A-Z]+\d+/g, "")
                  );
                  return (
                    <tr key={id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {course && isLocked(course) ? (
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
                              if (!course) return;
                              const updatedSelectedCourses = isSelected(course)
                                ? selectedCourses.filter(
                                    (c) => c !== course.courses[0].courseNumber
                                  )
                                : [
                                    ...selectedCourses,
                                    course.courses[0].courseNumber,
                                  ];
                              setSelectedCourses(updatedSelectedCourses);
                            }}
                          />
                        )}
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 overflow-hidden overflow-ellipsis cursor-pointer "
                        style={{ maxWidth: "450px" }}
                        // onClick={() => {
                        //   if (course) {
                        //     // Match SimilarCourses: pass the course wrapper
                        //     updateSelectedCourseInfo(course);
                        //   }
                        // }}
                        // title="Show course details"
                      >
                        {(course || {}).shortName || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {(course || {}).classification || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {course ? (course.credits / 100).toFixed(2) : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {similarCourses.ids[0].indexOf(id) + 1}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      ) : searchInput && similarCourses.ids && !isLoading ? (
        <div className="text-center mt-4">
          {/* Show message if upsert was needed but disabled */}
          {similarCourses.message ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 text-yellow-400 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-sm text-yellow-800">
                  {similarCourses.message}
                </p>
              </div>
            </div>
          ) : (
            <p>No similar courses found</p>
          )}
        </div>
      ) : null}
    </>
  );
}

export { SmartSearch };
