import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/lib/i18n/routing';

const intl = createMiddleware(routing);

/**
 * Locale routing, and the Content-Security-Policy.
 *
 * The CSP lives here rather than in next.config.ts because it needs a fresh
 * nonce per request. It was previously a static `script-src 'self'` header,
 * which is strictly correct and completely broken: Next.js bootstraps the app
 * with inline <script> tags, `'self'` does not cover inline, so the browser
 * refused them, React never hydrated and every page rendered blank. `curl`
 * showed perfect HTML the whole time, because curl does not enforce CSP. Only
 * a real browser did.
 *
 * The fix is a nonce, not 'unsafe-inline'. The concept note requires no
 * third-party trackers, and a policy with 'unsafe-inline' cannot make that
 * promise credible - any injected string would run.
 *
 * Next.js reads the nonce from the Content-Security-Policy on the REQUEST and
 * stamps it onto the scripts it emits, so the header is set on the request
 * headers that are forwarded, and again on the response for the browser.
 */
function buildCsp(nonce: string): string {
  const dev = process.env.NODE_ENV !== 'production';
  return [
    "default-src 'self'",
    // 'strict-dynamic' lets the nonced bootstrap load the chunks it needs
    // without listing each one. In development Next uses eval for HMR.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "worker-src 'self' blob:",
    // Styles stay 'unsafe-inline': CSS Modules are external, but React inlines
    // a handful of style attributes and a style nonce would break them. An
    // injected stylesheet cannot exfiltrate on its own the way a script can.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    // Tile and analytics origins are added here explicitly when chosen. Closed
    // by default so "no third-party trackers" is verifiable from this line.
    `connect-src 'self'${dev ? ' ws: http://127.0.0.1:* http://localhost:*' : ''}`,
    "font-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

export default function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce);

  // Forward to the app, so Next can put the nonce on its own scripts.
  request.headers.set('x-nonce', nonce);
  request.headers.set('content-security-policy', csp);

  const response = intl(request) ?? NextResponse.next();
  response.headers.set('content-security-policy', csp);
  response.headers.set('x-nonce', nonce);
  return response;
}

export const config = {
  matcher: ['/((?!_next|_vercel|fonts|eu|.*\\..*).*)'],
};
