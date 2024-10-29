// src/app/page.tsx
import Link from 'next/link';
import { Play, Upload, DollarSign, Search } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="space-y-24 pb-16">
      {/* Hero Section */}
      <section className="relative py-20 -mt-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center space-y-8">
            <h1 className="text-5xl sm:text-6xl font-bold text-white leading-tight">
              Your Creative Journey<br />Starts Here
            </h1>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto">
              Discover, share, and monetize exceptional video content in the world`s most vibrant creator marketplace.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link
                href="/videos"
                className="inline-flex items-center px-8 py-4 bg-white text-blue-600 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 group"
              >
                <Play className="w-5 h-5 mr-2 transition-transform group-hover:scale-110" />
                Browse Videos
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center px-8 py-4 bg-blue-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:bg-blue-600 transition-all duration-200"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Why Choose Video Platform?
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Join thousands of creators and businesses who trust our platform
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-12">
          <div className="text-center group">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-200">
              <Search className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Discover</h3>
            <p className="text-gray-600 leading-relaxed">
              Access a curated collection of premium videos from talented creators worldwide. Find the perfect content for your projects.
            </p>
          </div>

          <div className="text-center group">
            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-200">
              <Upload className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Share</h3>
            <p className="text-gray-600 leading-relaxed">
              Upload and showcase your video content to a global audience. Build your brand and grow your creative portfolio.
            </p>
          </div>

          <div className="text-center group">
            <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-200">
              <DollarSign className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Earn</h3>
            <p className="text-gray-600 leading-relaxed">
              Turn your creativity into income. Set your prices and earn money from every video sale on our platform.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="p-8">
              <div className="font-bold text-4xl text-blue-600 mb-2">10K+</div>
              <div className="text-gray-600">Active Creators</div>
            </div>
            <div className="p-8">
              <div className="font-bold text-4xl text-blue-600 mb-2">50K+</div>
              <div className="text-gray-600">Premium Videos</div>
            </div>
            <div className="p-8">
              <div className="font-bold text-4xl text-blue-600 mb-2">1M+</div>
              <div className="text-gray-600">Happy Customers</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 md:p-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Start Your Journey?
          </h2>
          <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
            Join our community of creators and start sharing your videos today
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center px-8 py-4 bg-white text-blue-600 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
            >
              Get Started
            </Link>
            <Link
              href="/videos"
              className="inline-flex items-center px-8 py-4 bg-blue-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:bg-blue-600 transition-all duration-200"
            >
              Browse Videos
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}