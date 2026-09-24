import { redirect } from './routing';

type RedirectArgs = Parameters<typeof redirect>[0];

/**
 * next-intl's `redirect` navigates by THROWING, and its type says so - it
 * returns `never`. But it is exported from a destructured
 * `createNavigation(...)` result, so its type is inferred rather than
 * annotated, and TypeScript only treats a call as never-returning when the
 * callee is a name with an explicit annotation.
 *
 * Re-exporting it through one is the whole of this file. With it, code after a
 * redirect is correctly seen as unreachable, so a guard can end on a redirect
 * without a fake `return` and `parsed.data` narrows properly after a validation
 * failure. Without it, every call site grows an unreachable throw.
 */
export const redirectTo: (args: RedirectArgs) => never = redirect;
