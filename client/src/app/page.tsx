// src/app/page.tsx
export default function HomePage() {
  return (
    <div className="space-y-6">
      <section className="text-center py-12">
        <h1 className="text-4xl font-bold mb-4">Welcome to Video Platform</h1>
        <p className="text-xl text-gray-600 mb-8">Share and discover amazing videos</p>
        <div className="flex justify-center gap-4">
          <a href="/videos" className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Browse Videos
          </a>
          <a href="/register" className="px-6 py-3 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200">
            Get Started
          </a>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-6 py-12">
        <div className="text-center p-6">
          <h3 className="text-xl font-semibold mb-2">Discover</h3>
          <p className="text-gray-600">Find amazing videos from creators worldwide</p>
        </div>
        <div className="text-center p-6">
          <h3 className="text-xl font-semibold mb-2">Share</h3>
          <p className="text-gray-600">Upload and share your own videos</p>
        </div>
        <div className="text-center p-6">
          <h3 className="text-xl font-semibold mb-2">Earn</h3>
          <p className="text-gray-600">Monetize your content</p>
        </div>
      </section>
    </div>
  );
}