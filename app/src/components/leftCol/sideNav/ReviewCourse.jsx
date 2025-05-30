import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Dialog } from "@headlessui/react";
import ReactStars from "react-rating-stars-component";
// import TextareaAutosize from "react-textarea-autosize";
import { Tooltip as ReactTooltip } from "react-tooltip";
import { useRecoilState, useRecoilValue } from "recoil";
import {
  SubmitCourseRatingById,
  coursesTakenForRatingState,
} from "../../recoil/coursesTakenForRatings";
import { authTokenState } from "../../recoil/authAtom";

export const ReviewCourse = ({ courseName, submittable, setSubmittable }) => {
  // const openCourses = ["test"]

  const [open, setOpen] = useState(false);
  const [doubleClick, setDoubleClick] = useState(false);
  // const [openCourses, setOpenCourses] = useState([]);
  const [openCourses, setOpenCourses] = useRecoilState(
    coursesTakenForRatingState
  );

  // this is used to reset the reviews when the form is submitted
  const [reset, setReset] = useState(false);

  // could obviously be done with a single state, but :shrug:
  const [courseId, setCourseId] = useState("");

  const [semester] = useState("HS22");
  // const [, setComment] = useState("");
  const [topic, setTopic] = useState(null);
  const [exam, setExam] = useState(null);
  const [lecture, setLecture] = useState(null);
  // const [professor, setProfessor] = useState(null);
  const [materials, setMaterials] = useState(null);
  const [workload, setWorkload] = useState(null);

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
  };

  useEffect(() => {
    if (open && reset && openCourses && openCourses.length > 0) {
      setReset(false);
    }
  }, [open, reset, openCourses]);

  const token = useRecoilValue(authTokenState);

  const handleSubmit = () => {
    SubmitCourseRatingById(token, review);
    // postRating(review);
    // console.log("### POSTED Rating: ", review)
    const newOpenCourses = openCourses.filter(
      (course) => course.courseId !== courseId
    );
    setOpenCourses(newOpenCourses);
    setCourseId("");
    if (newOpenCourses && newOpenCourses.length === 0) {
      setOpen(false);
    }
  };

  // const selectAllText = (e) => {
  //   if (doubleClick) {
  //     e.target.select();
  //   }
  //   setDoubleClick(!doubleClick);
  // };

  // set timer that sets doubleClick to false after 500ms
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDoubleClick(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [doubleClick]);

  const baseStyle = {
    count: 5,
    size: 24,
    // activeColor: "#007A2D", green
    activeColor: "#ffd700",
    isHalf: true,
  };

  useEffect(() => {
    if (hasNull(review.ratings) === false) {
      setSubmittable(true);
    } else {
      setSubmittable(false);
    }
  }, [review.ratings, setSubmittable]);

  function hasNull(target) {
    for (let member in target) {
      if (target[member] == null) return true;
    }
    return false;
  }

  const tooltipTexts = {
    topic: "Were the topics covered what you expected from the course sheet?",
    lecture: "How well was the lecture structured?",
    materials:
      "How well did the provided course materials support your education?",
    // professor: "How well did the professor perform?",
    exam: "Was the exam fair?",
    workload: "Was the workload appropriate for the ECTS?",
  };

  return (
    <div>
      <Dialog.Title as="h2" className="mb-4 text-xl font-bold text-gray-900">
        <span className="font-medium">{courseName}</span>
      </Dialog.Title>
      <div className="mt-3 sm:mt-5">
        <div className="grid grid-cols-2 font-semibold gap-x-4 gap-y-4">
          <div className="grid items-center grid-cols-2 bg-gray-100 rounded-lg">
            <div data-tip="tooltip" data-for="topic" className="text-lg">
              Topic*
            </div>
            <ReactStars onChange={setTopic} {...baseStyle} />
            <ReactTooltip id="topic" type="light">
              <span>{tooltipTexts.topic}</span>
            </ReactTooltip>
          </div>
          <div className="grid items-center grid-cols-2 bg-gray-100">
            <div data-tip="tooltip" data-for="Exam" className="text-lg">
              Exam*
            </div>
            <ReactStars onChange={setExam} {...baseStyle} />
            <ReactTooltip id="Exam" type="light">
              <span>{tooltipTexts.exam}</span>
            </ReactTooltip>
          </div>
          <div className="grid items-center grid-cols-2 bg-gray-100">
            <div data-tip="tooltip" data-for="Lecture" className="text-lg">
              Lecture*
            </div>
            <ReactStars onChange={setLecture} {...baseStyle} />
            <ReactTooltip id="Lecture" type="light">
              <span>{tooltipTexts.lecture}</span>
            </ReactTooltip>
          </div>
          {/* <div className="grid items-center grid-cols-2 bg-gray-100">
            <div data-tip="tooltip" data-for="Professor" className="text-lg">
              Professor*
            </div>
            <ReactStars onChange={setProfessor} {...baseStyle} />
            <ReactTooltip id="Professor" type="light">
              <span>{tooltipTexts.professor}</span>
            </ReactTooltip>
          </div> */}

          <div className="grid items-center grid-cols-2 bg-gray-100">
            <div data-tip="tooltip" data-for="Materials" className="text-lg">
              Materials*
            </div>
            <ReactStars onChange={setMaterials} {...baseStyle} />
            <ReactTooltip id="Materials" type="light">
              <span>{tooltipTexts.materials}</span>
            </ReactTooltip>
          </div>
          <div className="grid items-center grid-cols-2 bg-gray-100">
            <div data-tip="tooltip" data-for="Workload" className="text-lg">
              Workload*
            </div>
            <ReactStars onChange={setWorkload} {...baseStyle} />
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
  );
};

ReviewCourse.propTypes = {
  courseName: PropTypes.string.isRequired,
  submittable: PropTypes.bool.isRequired,
  setSubmittable: PropTypes.func.isRequired,
};
