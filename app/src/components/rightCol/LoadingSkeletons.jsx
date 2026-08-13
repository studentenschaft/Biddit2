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