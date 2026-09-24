import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

/**
 * Security headers are set here rather than at the proxy so they travel with
 * the application to whichever EU region it is deployed in.
 *
 * The Content-Security-Policy deliberately has no 'unsafe-inline' for scripts
 * and no third-party script origin: the note requires no third-party trackers,
 * and a CSP that admits one makes that promise unverifiable.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  // MapLibre needs a worker and inline styles for its canvas overlays.
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  // Tiles are fetched from whatever SYLVA_MAP_STYLE_URL points at; that origin
  // must be added here explicitly at deploy time. Left closed by default.
  "connect-src 'self'",
  // Fonts are self-hosted. Loading them from a non-EU CDN would move a request,
  // and therefore an IP address, outside the EU on every page view.
  "font-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const config = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=(), interest-cohort=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default withNextIntl(config);
