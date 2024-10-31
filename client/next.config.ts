/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*'
      }
    ]
  },
  env: {
    NEXT_PUBLIC_AWS_REGION: process.env.NEXT_PUBLIC_AWS_REGION,
    NEXT_PUBLIC_AWS_BUCKET_DOMAIN: process.env.NEXT_PUBLIC_AWS_BUCKET_DOMAIN,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_AUTH_COOKIE_NAME: process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME,
    NEXT_PUBLIC_ENABLE_VIDEO_UPLOAD: process.env.NEXT_PUBLIC_ENABLE_VIDEO_UPLOAD,
    NEXT_PUBLIC_ENABLE_STRIPE: process.env.NEXT_PUBLIC_ENABLE_STRIPE,
    NEXT_PUBLIC_ANALYTICS_ID: process.env.NEXT_PUBLIC_ANALYTICS_ID,
    NEXT_PUBLIC_MOCK_API: process.env.NEXT_PUBLIC_MOCK_API,
    NEXT_PUBLIC_DEBUG_MODE: process.env.NEXT_PUBLIC_DEBUG_MODE
  },
  images: {
    domains: ['kevinklatman.s3.amazonaws.com']
  }
}

module.exports = nextConfig