import mdx from '@next/mdx'
import bundleAnalyzer from '@next/bundle-analyzer'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' })

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const withMDX = mdx()

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Allow development origins for ngrok and other tunneling services
  allowedDevOrigins: [
    'e736-180-252-163-69.ngrok-free.app',
    '*.ngrok.io',
    '*.ngrok-free.app', 
    '*.ngrok.app',
    '*.localhost.run',
    '*.loca.lt',
    'localhost:3000',
    '127.0.0.1:3000',
  ],
  
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'pbs.twimg.com' },
      { protocol: 'https', hostname: 'abs.twimg.com' },
      { protocol: 'https', hostname: 'p16-sign-va.tiktokcdn.com' },
      { protocol: 'https', hostname: 'p16-sign-sg.tiktokcdn.com' },
      { protocol: 'https', hostname: 'p16-sign.tiktokcdn-us.com' },
      { protocol: 'https', hostname: 'p19-sign.tiktokcdn-us.com' },
      { protocol: 'https', hostname: 'i.vimeocdn.com' },
      { protocol: 'https', hostname: 'vumbnail.com' },
      { protocol: 'https', hostname: 'i.scdn.co' },
      { protocol: 'https', hostname: 'mosaic.scdn.co' },
      { protocol: 'https', hostname: 'seeded-session-images.scdn.co' },
    ],
  },
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],

  experimental: {
    mdxRs: true,
    // Enable webpack build worker for better performance
    webpackBuildWorker: true,
    // Enable optimized package imports
    optimizePackageImports: [
      'react-tweet',
      'lucide-react',
      'iconoir-react',
      'react-icons',
      '@radix-ui/react-dialog',
      '@radix-ui/react-toast',
      '@radix-ui/react-label',
      '@radix-ui/react-slot',
    ],
  },

  // Webpack configuration
  webpack: (config, { dev, isServer }) => {
    // Optimize caching strategy
    if (!dev && !isServer) {
      config.cache = {
        type: 'filesystem',
        version: '1.0',
        cacheDirectory: '.next/cache/webpack',
        store: 'pack',
        buildDependencies: {
          config: [__filename],
        },
        // Optimize serialization for large strings
        compression: 'gzip',
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
        // Reduce memory usage for large strings
        maxMemoryGenerations: 1,
      }
    }

    // Optimize bundle splitting
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: 'all',
        minSize: 20000,
        maxSize: 244000,
        cacheGroups: {
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: -10,
            chunks: 'all',
          },
          // Separate large libraries
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            name: 'react',
            chunks: 'all',
            priority: 20,
          },
          tweet: {
            test: /[\\/]node_modules[\\/]react-tweet[\\/]/,
            name: 'tweet',
            chunks: 'all',
            priority: 15,
          },
          ui: {
            test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
            name: 'ui',
            chunks: 'all',
            priority: 10,
          },
        },
      },
    }

    // Handle SVG imports
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    })

    // Optimize module resolution
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': resolve(__dirname, './'),
    }

    return config
  },

  // Output configuration
  output: 'standalone',
  
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Performance optimizations
  poweredByHeader: false,
  reactStrictMode: true,
  
  // Enable static optimization
  trailingSlash: false,
}

export default withBundleAnalyzer(withMDX(nextConfig))
