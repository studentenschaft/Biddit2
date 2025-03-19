// LoadingSkeletons.jsx //

export const LoadingSkeletonTranscript = () => (
    <div>
    {[...Array(6)].map((_, index) => (
        <div key={index} className="space-y-2">
          <div className="h-6 bg-gray-200 rounded w-full" />
          <div className="h-6 bg-gray-200 rounded w-5/6" />
          <div className="h-6 bg-gray-200 rounded w-4/6" />
        </div>
      ))}
    </div>
);


  // Loading Screen in StudyOverview
  export const LoadingSkeletonStudyOverview = () => (
  <div className="animate-pulse">
     <div className="space-y-2"></div>
    {/* Program Header Placeholder */}
    <div className="h-6 bg-gray-300 rounded w-2/3 mb-4" />

    {/* Semester Loading Rows */}
    {["HS23", "FS24", "HS24", "FS25"].map((semester, index) => (
      <div key={index} className="grid grid-cols-12 gap-2 items-center mb-4">
        {/* Semester Label */}
        {/* <div className="h-6 bg-gray-200 rounded w-12 col-span-2 md:col-span-1" /> */}

        {/* Course Blocks Placeholder */}
        <div className="col-span-6 md:col-span-8 flex flex-row h-8 space-x-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-6 bg-gray-300 rounded w-8" />
          ))}
        </div>

        {/* ECTS and Grade Placeholder */}
        <div className="col-span-4 md:col-span-3 flex justify-end space-x-4">
          <div className="h-6 bg-gray-200 rounded w-16" />
          <div className="h-6 bg-gray-200 rounded w-10" />
        </div>
      </div>
    ))}
  </div>
);