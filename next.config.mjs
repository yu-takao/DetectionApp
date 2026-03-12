/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Amplify SSR: explicitly pass server-side env vars to the compute runtime
  env: {
    IOT_DATA_ENDPOINT: process.env.IOT_DATA_ENDPOINT,
    IOT_ENDPOINT: process.env.IOT_ENDPOINT,
    RECORDER_CONFIG_TABLE: process.env.RECORDER_CONFIG_TABLE,
  },
}

export default nextConfig
