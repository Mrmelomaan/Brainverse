import type { NextConfig } from 'next';

// Vercel already sends HSTS on the custom domain. No CSP on purpose: Next's inline scripts make a strict
// one a project of its own, and the app loads no third-party scripts.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
];

const nextConfig: NextConfig = {
  // Keep `next dev` from writing AGENTS.md / CLAUDE.md into the repo.
  agentRules: false,
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;
