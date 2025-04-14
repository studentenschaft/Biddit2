import React, { Fragment, useEffect, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { XIcon } from "@heroicons/react/outline";
import ReactStars from "react-rating-stars-component";
import { Tooltip as ReactTooltip } from "react-tooltip";
// import TextareaAutosize from "react-textarea-autosize";
import {
  SubmitCourseRatingById,
  coursesTakenForRatingState,
} from "../../recoil/coursesTakenForRatings";

import { useRecoilState, useRecoilValue } from "recoil";
import { authTokenState } from "../../recoil/authAtom";

// import { ReviewCourse } from "./ReviewCourse";
import { StarIcon } from "@heroicons/react/outline";
import { reviewMenuModalState } from "../../recoil/reviewMenuModal";
import {
  reviewCommentState,
  reviewCourseIdState,
  reviewCourseNameState,
  reviewExamState,
  reviewLectureState,
  reviewMaterialsState,
  // reviewProfessorState,
  reviewSemesterState,
  reviewTopicState,
  reviewWorkloadState,
} from "../../recoil/reviewCourse";

export const ReviewButton = () => {
  // const openCourses = ["test"]

  // const [open, setOpen] = useState(false);
  const [open, setOpen] = useRecoilState(reviewMenuModalState);
  const [doubleClick, setDoubleClick] = useState(false);
  // const [openCourses, setOpenCourses] = useState([]);
  const [submittable, setSubmittable] = useState(false);

  // this is used to reset the reviews when the form is submitted
  const [reset, setReset] = useState(false);

  // could obviously be done with a single state, but :shrug:
  // const [courseId, setCourseId] = useState("");
  const [courseId, setCourseId] = useRecoilState(reviewCourseIdState);
  // const [courseName, setCourseName] = useState("");
  const [courseName, setCourseName] = useRecoilState(reviewCourseNameState);
  // const [semester, setSemester] = useState("HS22");
  const [semester, setSemester] = useRecoilState(reviewSemesterState);
  // const [comment, setComment] = useState("");
  const [comment, setComment] = useRecoilState(reviewCommentState);
  // const [topic, setTopic] = useState(null);
  const [topic, setTopic] = useRecoilState(reviewTopicState);
  // const [exam, setExam] = useState(null);
  const [exam, setExam] = useRecoilState(reviewExamState);
  // const [lecture, setLecture] = useState(null);
  const [lecture, setLecture] = useRecoilState(reviewLectureState);
  // const [professor, setProfessor] = useState(null);
  // const [professor, setProfessor] = useRecoilState(reviewProfessorState);
  // const [materials, setMaterials] = useState(null);
  const [materials, setMaterials] = useRecoilState(reviewMaterialsState);
  // const [workload, setWorkload] = useState(null);
  const [workload, setWorkload] = useRecoilState(reviewWorkloadState);
  const [openCourses, setOpenCourses] = useRecoilState(
    coursesTakenForRatingState
  );

  // const selectAllText = (e) => {
  //   if (doubleClick) {
  //     e.target.select();
  //   }
  //   setDoubleClick(!doubleClick);
  // };

  const token = useRecoilValue(authTokenState);

  // this object can ultimately be passed to the backend
  // check the handleSubmit function for more details
  const review = {
    courseNumber: courseId,
    courseTitle: courseName,
    semester: semester,
    ratings: {
      topic: topic,
      lecture: lecture,
      materials: materials,
      // professor: professor,
      exam: exam,
      workload: workload,
    },
    comment: comment,
  };

  function updateCookie() {
    if (openCourses && !openCourses.length > 0) return;
    setOpen(!open);
  }

  const handleSubmit = () => {
    SubmitCourseRatingById(token, review);
    // console.log(review);
    const newOpenCourses = openCourses.filter(
      (course) => course.courseId !== courseId
    );
    setOpenCourses(newOpenCourses);
    setCourseId("");
    if (newOpenCourses && newOpenCourses.length === 0) {
      setOpen(false);
    }
  };

  useEffect(() => {
    if (open && reset && openCourses && openCourses.length > 0) {
      setReset(false);
    }
  }, [open, reset, openCourses]);

  function resetCourse(selectedCourse) {
    if (openCourses && !openCourses.length > 0) return;
    // remove the course from the array

    // console.log(openCourses, openCourses[openCourses.length - 1]);
    // let currentCourse = openCourses[openCourses.length - 1];
    setCourseId(selectedCourse.courseId);
    setCourseName(selectedCourse.courseName);
    setSemester(selectedCourse.semesterName);
    setExam(null);
    setLecture(null);
    // setProfessor(null);
    setMaterials(null);
    setWorkload(null);
    setTopic(null);
    setComment("");
    setReset(true);
  }

  const baseStyle = {
    count: 5,
    size: 24,
    // activeColor: "#007A2D", green
    activeColor: "#ffd700",
    isHalf: true,
  };

  const tooltipTexts = {
    topic: "Were the topics covered what you expected from the course sheet?",
    lecture: "How well was the lecture structured?",
    materials:
      "How well did the provided course materials support your education?",
    // professor: "How well did the professor perform?",
    exam: "Was the exam fair?",
    workload: "Was the workload appropriate for the ECTS?",
  };

  // set timer that sets doubleClick to false after 500ms
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDoubleClick(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [doubleClick]);

  useEffect(() => {
    if (hasNull(review.ratings) === false) {
      setSubmittable(true);
    } else {
      setSubmittable(false);
    }
  }, [review.ratings]);

  function hasNull(target) {
    for (let member in target) {
      if (target[member] == null) return true;
    }
    return false;
  }

  // const cancelButtonRef = useRef(null);

  return (
    <>
      <button
        className="relative inline-flex items-center justify-center p-2 text-white rounded-md hover:bg-hsg-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white active:bg-hsg-800"
        onClick={() => updateCookie()}
      >
        <StarIcon
          className={`block w-6 h-6 ${
            openCourses && openCourses.length > 0
              ? "text-yellow-500 animate-pulse"
              : ""
          }`}
          aria-hidden="true"
          fill={openCourses && openCourses.length > 0 ? "currentColor" : "none"}
        />
        {openCourses && openCourses.length > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 transform bg-red-600 rounded-full translate-x-1/4 -translate-y-1/4">
            {openCourses.length}
          </span>
        )}
      </button>
      {open ? (
        <Transition.Root show={open} as={Fragment}>
          <Dialog
            as="div"
            className="relative z-10"
            // initialFocus={cancelButtonRef}
            onClose={setOpen}
          >
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 transition-opacity backdrop-filter backdrop-blur" />
            </Transition.Child>

            <div className="fixed inset-0 z-10 overflow-y-auto">
              <div className="flex items-end justify-center min-h-full p-4 text-center sm:items-center sm:p-0">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                  enterTo="opacity-100 translate-y-0 sm:scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                  leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                >
                  <Dialog.Panel className="relative w-1/2 px-4 pt-5 pb-4 overflow-hidden text-center transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:p-6">
                    <div className="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
                      <button
                        type="button"
                        className="p-1 text-gray-400 bg-white rounded-md hover:text-gray-500"
                        onClick={() => setOpen(false) & setCourseId("")}
                      >
                        <span className="sr-only">Close</span>
                        <XIcon className="w-6 h-6" aria-hidden="true" />
                      </button>
                    </div>

                    {!reset && courseId ? (
                      <div>
                        <Dialog.Title
                          as="h2"
                          className="mb-4 text-xl font-bold text-gray-900"
                        >
                          <span className="font-medium">{courseName}</span>
                        </Dialog.Title>
                        <div className="mt-3 sm:mt-5">
                          <div className="grid grid-cols-2 font-semibold gap-x-4 gap-y-4">
                            <div className="grid items-center grid-cols-2 bg-gray-100 rounded-lg">
                              <div
                                data-tip="tooltip"
                                data-for="topic"
                                className="text-lg"
                              >
                                Topic*
                              </div>
                              <ReactStars onChange={setTopic} {...baseStyle} />
                              <ReactTooltip id="topic" type="light">
                                <span>{tooltipTexts.topic}</span>
                              </ReactTooltip>
                            </div>
                            <div className="grid items-center grid-cols-2 bg-gray-100">
                              <div
                                data-tip="tooltip"
                                data-for="Exam"
                                className="text-lg"
                              >
                                Exam*
                              </div>
                              <ReactStars onChange={setExam} {...baseStyle} />
                              <ReactTooltip id="Exam" type="light">
                                <span>{tooltipTexts.exam}</span>
                              </ReactTooltip>
                            </div>
                            <div className="grid items-center grid-cols-2 bg-gray-100">
                              <div
                                data-tip="tooltip"
                                data-for="Lecture"
                                className="text-lg"
                              >
                                Lecture*
                              </div>
                              <ReactStars
                                onChange={setLecture}
                                {...baseStyle}
                              />
                              <ReactTooltip id="Lecture" type="light">
                                <span>{tooltipTexts.lecture}</span>
                              </ReactTooltip>
                            </div>
                            {/* <div className="grid items-center grid-cols-2 bg-gray-100">
                                                            <div
                                                                data-tip="tooltip"
                                                                data-for="Professor"
                                                                className="text-lg"
                                                            >
                                                                Professor*
                                                            </div>
                                                            <ReactStars
                                                                onChange={
                                                                    setProfessor
                                                                }
                                                                {...baseStyle}
                                                            />
                                                            <ReactTooltip
                                                                id="Professor"
                                                                type="light"
                                                            >
                                                                <span>
                                                                    {
                                                                        tooltipTexts.professor
                                                                    }
                                                                </span>
                                                            </ReactTooltip>
                                                        </div> */}

                            <div className="grid items-center grid-cols-2 bg-gray-100">
                              <div
                                data-tip="tooltip"
                                data-for="Materials"
                                className="text-lg"
                              >
                                Materials*
                              </div>
                              <ReactStars
                                onChange={setMaterials}
                                {...baseStyle}
                              />
                              <ReactTooltip id="Materials" type="light">
                                <span>{tooltipTexts.materials}</span>
                              </ReactTooltip>
                            </div>
                            <div className="grid items-center grid-cols-2 bg-gray-100">
                              <div
                                data-tip="tooltip"
                                data-for="Workload"
                                className="text-lg"
                              >
                                Workload*
                              </div>
                              <ReactStars
                                onChange={setWorkload}
                                {...baseStyle}
                              />
                              <ReactTooltip id="Workload" type="light">
                                <span>{tooltipTexts.workload}</span>
                              </ReactTooltip>
                            </div>
                          </div>
                          {/* <div className="pt-4 mb-4">
                            <TextareaAutosize
                              minRows="2"
                              style={{
                                width: "100%",
                                borderStyle: "none",
                                overflow: "auto",
                                borderColor: "transparent",
                                resize: "none",
                                outline: "none",
                                boxShadow: "none",
                                backgroundColor: "#f3f4f6",
                                borderRadius: "8px",
                                fontSize: "1.1rem",
                              }}
                              placeholder="Write a review"
                              onClick={selectAllText}
                              onChange={(e) => setComment(e.target.value)}
                            />
                          </div> */}
                          {!submittable ? (
                            <div
                              className="inline-flex items-center px-6 py-3 text-base font-medium text-white bg-gray-300 border border-transparent rounded-md shadow-sm"
                              style={{
                                fontSize: "1.1rem",
                                fontWeight: "semibold",
                                paddingTop: "0.5rem",
                              }}
                            >
                              Rate all categories
                            </div>
                          ) : (
                            <button
                              className="inline-flex items-center px-6 py-3 text-base font-medium text-white border border-transparent rounded-md shadow-sm bg-hsg-600 hover:bg-hsg-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-hsg-500"
                              onClick={handleSubmit}
                              hidden={false}
                              style={{
                                fontSize: "1.1rem",
                                fontWeight: "semibold",
                                paddingTop: "0.5rem",
                              }}
                            >
                              Submit Review
                            </button>
                          )}
                        </div>
                      </div>
                    ) : // <ReviewCourse
                    //   courseName={courseName}
                    //   submittable={submittable}
                    //   setSubmittable={setSubmittable}
                    // />
                    !reset && courseId === "" ? (
                      <div>
                        <h1 className="text-xl font-bold text-gray-900">
                          Please select a course to rate:
                        </h1>
                        {/* <div className="overflow-auto h-96"> */}
                        {Array.from(
                          new Set(
                            openCourses.map((course) => {
                              return course.semesterName;
                            })
                          )
                        ).map((semester) => (
                          <div key={semester} className="">
                            <div
                              key={semester}
                              className="pt-4 text-lg font-medium"
                            >
                              {semester}
                            </div>
                            <div className="grid grid-cols-2">
                              {openCourses.map(
                                (course) =>
                                  course.semesterName === semester && (
                                    <div
                                      className="flex p-2 rounded-md"
                                      key={course.courseId}
                                    >
                                      <button
                                        className="items-center flex-1 px-6 py-3 text-base font-medium text-white border border-transparent rounded-md shadow-sm bg-hsg-600 hover:bg-hsg-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-hsg-500"
                                        onClick={() => {
                                          resetCourse(course);
                                        }}
                                      >
                                        <p className="line-clamp-2">
                                          {course.courseName}
                                        </p>
                                      </button>
                                    </div>
                                  )
                              )}
                            </div>
                          </div>
                        ))}
                        {/* </div> */}
                      </div>
                    ) : null}
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition.Root>
      ) : null}
    </>
  );
};
