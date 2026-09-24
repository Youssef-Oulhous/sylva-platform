import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';
import { defaultLocale, locales } from './config';

/**
 * 'as-needed' keeps English URLs clean (/projects/demo-untere-havel...) and
 * prefixes German (/de/projekte/...). Project pages must be shareable and
 * indexable, so the canonical URL and hreflang alternates are emitted per page.
 */
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
});

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
