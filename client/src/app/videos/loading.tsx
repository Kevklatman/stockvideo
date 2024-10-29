// src/app/videos/loading.tsx
export default function Loading() {
    return (
      <div className="space-y-6">
        <div className="w-full h-12 bg-gray-200 rounded-md animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="animate-pulse">
              <div className="bg-gray-200 aspect-video rounded-lg"></div>
              <div className="mt-4 space-y-3">
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }