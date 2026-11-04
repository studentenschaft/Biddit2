import { useRecoilValue } from "recoil";
import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  availableCoursesSelector,
  selectedSemesterSelector,
} from "../recoil/unifiedCourseDataSelectors";
import { LockOpen } from "../leftCol/bottomRow/LockOpen";
import { LockClosed } from "../leftCol/bottomRow/LockClosed";
import LoadingText from "../common/LoadingText";
import { useOpenCourseDetails } from "../helpers/useOpenCourseDetails";
import { useVectorSearch } from "../helpers/useVectorSearch";
import { useDegradedMode } from "../common/useDegradedMode";
import DegradedPlaceholder from "../common/DegradedPlaceholder";
import { log } from "../helpers/log";
import { formatEcts, toEcts } from "../../domain/credits";

export default function SimilarCourses({ selectedCourse }) {
  const { isDegradedMode } = useDegradedMode();
  const { runQuery, isLoading, isUpserting } = useVectorSearch();
  const selectedSemesterShortName = useRecoilValue(selectedSemesterSelector);

  // For course lookups and display, always use the real selected semester (not reference)
  const coursesCurrentSemester = useRecoilValue(
    availableCoursesSelector(selectedSemesterShortName)
  );

  const [similarCourses, setSimilarCourses] = useState([]);
  // Allow showing course details when user clicks a similar course title
  const openCourseDetails = useOpenCourseDetails();

  async function fetchSimilarCourses() {
    if (!selectedCourse.courseContent) {
      console.error("Course content is missing");
      return;
    }
    const { ids, distances, metadatas } = await runQuery({
      courseDescription: selectedCourse.courseContent,
    });
    setSimilarCourses({
      ids: [ids],
      distances: [distances],
      metadatas: [metadatas],
    });
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
          creditsFilter === formatEcts(toEcts(course.credits));

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
        log.debug("Removed course due to low similarity:", id);
        log.debug("Distance:", distance);
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

  // Vector-DB backed search is SHSG-hosted; show a compact note instead of
  // a search button that can't return results.
  if (isDegradedMode) {
    return <DegradedPlaceholder compact feature="Similar courses" />;
  }

  return (
    <>
      <div className="flex items-end gap-4">
        <button
          className="w-fit h-fit  bg-green-800 hover:bg-gray-400 text-white lg:font-semibold lg:text-md md:text-sm py-2 px-4 rounded mt-4"
          onClick={fetchSimilarCourses}
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
                    return course ? formatEcts(toEcts(course.credits)) : null;
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

      {isLoading && !isUpserting ? (
        <div className="text-center">
          <br />
          <LoadingText>Loading similar courses...</LoadingText>
        </div>
      ) : isUpserting ? (
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
                        openCourseDetails(course, {
                          source: "similar-courses",
                        });
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
                      {formatEcts(
                        toEcts(
                          coursesCurrentSemester.find(
                            (course) =>
                              course.courseNumber ===
                              id.replace(/[A-Z]+\d+/g, "")
                          )?.credits
                        )
                      )}
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
