const fallbackSupabaseUrl = "http://127.0.0.1:54321";
const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackSupabaseUrl;

const remotePatterns = [];
const extraImageHosts = ["images.unsplash.com"];

try {
  const supabaseUrl = new URL(rawSupabaseUrl);
  remotePatterns.push({
    protocol: supabaseUrl.protocol.replace(":", ""),
    hostname: supabaseUrl.hostname,
    port: supabaseUrl.port,
    pathname: "/**",
  });
} catch {}

for (const hostname of extraImageHosts) {
  remotePatterns.push({
    protocol: "https",
    hostname,
    pathname: "/**",
  });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    unoptimized: true,
    remotePatterns,
  },
  async redirects() {
    return [
      {
        source: '/index.html',
        destination: '/',
        permanent: true,
      },
      {
        source: '/products.html',
        destination: '/products',
        permanent: true,
      },
      {
        source: '/services.html',
        destination: '/services',
        permanent: true,
      },
      {
        source: '/admin',
        destination: '/admin.html',
        permanent: true,
      },
      {
        source: '/admin/:path*',
        destination: '/admin.html?section=:path*',
        permanent: true,
      },
      {
        source: '/dashboard/admin',
        destination: '/admin.html',
        permanent: true,
      },
      {
        source: '/dashboard/admin/:path*',
        destination: '/admin.html?section=:path*',
        permanent: true,
      },
      {
        source: '/dashboard/admin-users',
        destination: '/admin.html?section=customers',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
