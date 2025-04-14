import { useRecoilValue, useRecoilState } from "recoil";
import { selectedCourseCourseInfo } from "../recoil/selectedCourseCourseInfo";
import { ExternalLinkIcon } from "@heroicons/react/outline";
import { cisIdListSelector } from "../recoil/cisIdListSelector";
import { authTokenState } from "../recoil/authAtom";
import axios from "axios";
import { useEffect, useState } from "react";
import { examinationTypesState } from "../recoil/examinationTypesAtom";
import Collapsible from "./Collapsible";
import { StarIcon } from "@heroicons/react/solid";
import { Tooltip as ReactTooltip } from "react-tooltip";
import SimilarCourses from "./SimilarCourses.jsx";

// error handling
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";
export default function CourseInfo() {
  const selectedCourse = useRecoilValue(selectedCourseCourseInfo);
  const cisIdList = useRecoilValue(cisIdListSelector);
  const authToken = useRecoilValue(authTokenState);
  const [examinationIdState, setExaminationIdState] = useRecoilState(
    examinationTypesState
  );
  const [examInformationState, setExamInformation] = useState(null);
  const [containsCourseRatings, setContainsCourseRatings] = useState(false);

  let semesterAbbreviation = null;
  if (cisIdList && selectedCourse) {
    semesterAbbreviation = cisIdList.find(
      (item) => item.cisId === selectedCourse.semesterId
    )?.shortName;
  }

  // fetch achievement parts information (will be done every time a course is selected)
  async function fetchCourseInformation(selectedCourse, authToken) {
    try {
      const res = await axios.get(
        `https://integration.unisg.ch/EventApi/CourseInformationSheets/latestPublishedByHsgEntityId/${selectedCourse.hsgEntityId}`,
        {
          headers: {
            "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
            "X-RequestedLanguage": "EN",
            "API-Version": "3",
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      return res.data;
    } catch (err) {
      try {
        const res = await axios.get(
          `https://integration.unisg.ch/EventApi/CourseInformationSheets/latestPublishedByHsgEntityId/${selectedCourse.courses[0].courseNumber}`,
          {
            headers: {
              "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
              "X-RequestedLanguage": "EN",
              "API-Version": "3",
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        return res.data;
      } catch (err) {
        console.log(err);
        errorHandlingService.handleError(err);
        return null;
      }
    }
  }

  useEffect(() => {
    if (selectedCourse && authToken) {
      fetchCourseInformation(selectedCourse, authToken).then((data) => {
        setExamInformation(data);
      });
    }
  }, [selectedCourse, authToken]);

  // fetch exam types (will be done only once)

  async function fetchExaminationIds() {
    try {
      const res = await axios.get(
        `https://integration.unisg.ch/AcametaApi/ExaminationTypes?fields=id,shortName,description`,
        {
          headers: {
            "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
            "X-RequestedLanguage": "EN",
            "API-Version": "1",
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const examinationIdObject = {};
      res.data.forEach((examinationId) => {
        examinationIdObject[examinationId.id] = {
          shortName: examinationId.shortName,
          description: examinationId.description,
        };
      });

      setExaminationIdState(examinationIdObject);
    } catch (err) {
      console.log(err);
      errorHandlingService.handleError(err);
    }
  }

  useEffect(() => {
    if (authToken) {
      fetchExaminationIds();
    }
    //never include setters
    // eslint-disable-next-line
  }, [authToken]);

  // fetch ratings (will be done every time a course is selected)
  const [courseWithRatings, setCourseWithRatings] = useState(null);

  async function fetchCourseRatings(selectedCourse, authToken) {
    try {
      const res = await axios.get(
        `https://api.shsg.ch/course-ratings/by-course/${selectedCourse.courses[0].courseNumber}`,
        {
          headers: {
            "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
            "X-RequestedLanguage": "EN",
            "API-Version": "1",
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      res.data = res.data.filter(
        (course) => course.courseNumber !== "7,721,1.00" // this has been requested to be removed
      );

      if (res.data.length > 0) {
        const ratingData = res.data[0];
        const updatedCourse = {
          ...selectedCourse,
          avgRatings: ratingData.avgRatings,
          nbOfRatings: ratingData.nbOfRatings,
          comments: ratingData.comments,
        };

        setCourseWithRatings(updatedCourse);
      }
    } catch (err) {
      console.log(err);
      errorHandlingService.handleError(err);
    }
  }

  useEffect(() => {
    if (selectedCourse && authToken) {
      // Reset courseWithRatings before fetching new ratings
      setCourseWithRatings(null);
      fetchCourseRatings(selectedCourse, authToken);
    }
  }, [selectedCourse, authToken]);

  useEffect(() => {
    if (courseWithRatings && courseWithRatings.avgRating === "N/A") {
      setContainsCourseRatings(false);
    } else {
      setContainsCourseRatings(true);
    }
  }, [courseWithRatings, selectedCourse, setCourseWithRatings]);

  const tooltipTexts = {
    topic:
      "Were the topics covered in class what you expected from the course information sheet?",
    lecture: "How well was the lecture structured?",
    materials:
      "How well did the provided course materials support your education?",
    professor: "How well did the professor perform?",
    exam: "Was the exam fair?",
    workload: "Was the workload appropriate for the ECTS?",
  };

  return (
    <>
      {/* // Course Name and Link to courses page and course info sheet // */}

      <div className="flex-col flex p-2 md:p-4 h-full text-gray-800 rounded-lg shadow-sm overflow-y-auto">
        {/* <ErrorComponent /> */}
        {/* Course title and key info */}
        <header className="font-bold lg:text-2xl">
          <div className="flex justify-between pb-4">
            <a
              href={selectedCourse && selectedCourse.courses[0].timeTableLink}
              target="_blank"
              rel="noreferrer"
            >
              {selectedCourse && selectedCourse.shortName !== undefined
                ? selectedCourse.shortName
                : "Click on a course to see details."}
            </a>
            {semesterAbbreviation && (
              <a
                href={`https://tools.unisg.ch/handlers/Public/CourseInformationSheet.ashx/semester/${semesterAbbreviation}/eventnumber/${selectedCourse.courses[0].courseNumber}.pdf`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLinkIcon className="h-6 w-6" />
              </a>
            )}
          </div>
        </header>

        {/* // ECTS / Classifications / Central? / Lecturers // */}

        <div className="overflow-auto scrollbar-hide overscroll-auto">
          {selectedCourse && selectedCourse.shortName !== undefined ? (
            <div className="text-xs font-semibold text-gray-700 lg:text-base">
              <div className="" label="credits and exam info">
                {(selectedCourse.credits / 100).toFixed(2)} ECTS |{" "}
                {selectedCourse.classification}{" "}
                {selectedCourse.achievementFormStatus.isCentral &&
                selectedCourse.achievementFormStatus.isDeCentral
                  ? `| Central & Decentral (${selectedCourse.achievementFormStatus.description})`
                  : selectedCourse.achievementFormStatus.isCentral
                  ? `| Central (${selectedCourse.achievementFormStatus.description})`
                  : selectedCourse.achievementFormStatus.isDeCentral
                  ? `| Decentral (${selectedCourse.achievementFormStatus.description})`
                  : ""}
              </div>
              <div className="mb-4">
                {selectedCourse.courses &&
                  selectedCourse.courses.length > 0 &&
                  selectedCourse.courses[0].lecturers &&
                  selectedCourse.courses[0].lecturers
                    .map((prof) => {
                      return prof.displayName;
                    })
                    .join(" • ")}
              </div>
            </div>
          ) : null}

          {/* // Course Description // */}

          {courseWithRatings && containsCourseRatings && (
            <div
              className="grid grid-cols-1 lg:grid-cols-5 gap-8 text-base pb-4 "
              key={courseWithRatings.shortName}
            >
              <div className="col-span-2">
                <dl className="">
                  <div className="flex text-sm font-medium toggle text-gray-900">
                    <StarIcon className="w-6 h-6 mr-1" color="#386641" />
                    {courseWithRatings.avgRating} ·{" "}
                    {courseWithRatings.nbOfRatings}{" "}
                    {courseWithRatings.nbOfRatings === 1 ? "Rating" : "Ratings"}
                  </div>
                  {Object.keys(courseWithRatings.avgRatings)
                    .filter((category) => category !== "professor")
                    .map((category) => (
                      <dt key={category}>
                        <div className="items-center flex flex-row md:">
                          <div
                            className="capitalize w-1/3  mr-4"
                            data-tip="tooltip"
                            data-for={category}
                          >
                            {category}
                          </div>
                          <ReactTooltip id={category} type="light">
                            <span>{tooltipTexts[category]}</span>
                          </ReactTooltip>

                          <div className="bg-gray-300 rounded-full h-3 align-middle flex-1 ">
                            {/*  dark:bg-gray-600 */}
                            <div
                              className="bg-gray-500 h-3 rounded-full "
                              //dark:bg-gray-300
                              style={{
                                width: `${
                                  courseWithRatings.avgRatings[category] * 20
                                }%`,
                              }}
                            />
                          </div>
                          <div className="ml-4 w-1/6">
                            Ø {courseWithRatings.avgRatings[category]}
                          </div>
                        </div>
                      </dt>
                    ))}
                </dl>
              </div>
              {/* RATING COMMENTS */}
              {/* <div className="col-span-3 h-40 overflow-auto">
                            {courseWithRatings &&
                            "comments" in courseWithRatings &&
                            courseWithRatings.comments.length > 0 ? (
                                <dl className="space-y-2 ">
                                    {courseWithRatings.comments.map((comment) => (
                                        <div key={comment.text}>
                                            <dt className="">
                                                <h4 className="font-bold">
                                                    {comment.semester}
                                                </h4>
                                                <p className="">
                                                    {comment.text}
                                                </p>
                                            </dt>
                                        </div>
                                    ))}
                                </dl>
                            ) : (
                                <></>
                            )}
                        </div> */}
            </div>
          )}

          {/* // Exam Description // */}
          {/* Achievement parts is an empty array in events api --> new api call needed? TODO: */}
          <section className="pb-2">
            <h2 className="text-lg font-bold text-gray-700 ">
              Exam Information
            </h2>
            <div className="pb-1">
              {selectedCourse &&
              examInformationState &&
              examInformationState !== undefined ? (
                examInformationState.examinationParts.map((part, index) => {
                  return (
                    <div key={index} className="w-full text-sm">
                      <div className="grid grid-cols-3">
                        <div className="font-semibold">
                          {examinationIdState[part.examinationTypeId].shortName}
                        </div>
                        <div>{part.remark}</div>
                        <div className="text-left">{part.weightage / 100}%</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-base text-gray-700">
                  No Exam Information
                </div>
              )}
            </div>
          </section>
          {/* // General Course Description // */}
          <section className="flex flex-col flex-1" label="Course Information">
            <h2 className="flex-none pb-2 text-xl font-bold text-gray-700 ">
              Course Information
            </h2>

            <div className="flex-1 text-gray-700 rounded-lg">
              <Collapsible label="Learning Objectives" CloseOnToggle={false}>
                <div
                  dangerouslySetInnerHTML={{
                    __html: selectedCourse && selectedCourse.learningObjectives,
                  }}
                />
              </Collapsible>
              <Collapsible label="Content" CloseOnToggle={true}>
                <div
                  dangerouslySetInnerHTML={{
                    __html: selectedCourse && selectedCourse.courseContent,
                  }}
                />
              </Collapsible>
              <Collapsible label="Prerequisites" CloseOnToggle={true}>
                <div
                  dangerouslySetInnerHTML={{
                    __html:
                      selectedCourse && selectedCourse.coursePrerequisites,
                  }}
                />
              </Collapsible>

              <Collapsible label="Structure" CloseOnToggle={true}>
                <div
                  dangerouslySetInnerHTML={{
                    __html: selectedCourse && selectedCourse.courseStructure,
                  }}
                />
              </Collapsible>
              <Collapsible label="Literature" CloseOnToggle={true}>
                <div
                  dangerouslySetInnerHTML={{
                    __html: selectedCourse && selectedCourse.courseLiterature,
                  }}
                />
              </Collapsible>
              <Collapsible label="Additional Information" CloseOnToggle={true}>
                <div
                  dangerouslySetInnerHTML={{
                    __html:
                      selectedCourse &&
                      selectedCourse.courseAdditionalInformation,
                  }}
                />
              </Collapsible>
            </div>
          </section>
          {selectedCourse && <SimilarCourses selectedCourse={selectedCourse} />}
        </div>
      </div>
    </>
  );
}

export { CourseInfo };
