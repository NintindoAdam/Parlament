/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath,
  images: {
    unoptimized: true,
  },
  // Avoids failing the static export build on lint/type issues in CI data fetch.
  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig
