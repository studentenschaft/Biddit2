import { atom } from "recoil";

export const reviewCourseIdState = atom({
    key: 'reviewCourseId',
    default: ""
})

export const reviewCourseNameState = atom({
    key: 'reviewCourseName',
    default: ""
})

export const reviewSemesterState = atom({
    key: 'reviewSemester',
    default: null
})

export const reviewCommentState = atom({
    key: 'reviewComment',
    default: null
})

export const reviewTopicState = atom({
    key: 'reviewTopic',
    default: null
})

export const reviewExamState = atom({
    key: 'reviewExam',
    default: null
})

export const reviewLectureState = atom({
    key: 'reviewLecture',
    default: null
})

export const reviewProfessorState = atom({
    key: 'reviewProfessor',
    default: null
})

export const reviewMaterialsState = atom({
    key: 'reviewMaterials',
    default: null
})

export const reviewWorkloadState = atom({
    key: 'reviewWorkload',
    default: null
})