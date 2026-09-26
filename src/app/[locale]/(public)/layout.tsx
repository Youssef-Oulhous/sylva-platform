import { setRequestLocale } from 'next-intl/server';
import SiteHeader from '@/components/SiteHeader';
import WorkspaceChrome from '@/components/workspace/WorkspaceChrome';
import { getViewer } from '@/lib/auth/session';

/**
 * The pages anybody may read - and which header sits on top of them.
 *
 * Not "the public shell" any more. These URLs are public, but the PERSON
 * reading them may well be signed in, and when they are, they get their own
 * header here too. Signing in used to change only the page you landed on:
 * click Projects or How it works afterwards and the marketing navigation came
 * straight back, identical to a stranger's, which made signing in look like it
 * had done nothing.
 *
 * WorkspaceChrome returns null for a visitor, so the marketing header is what a
 * visitor still gets. getViewer() is cached per request, so asking here costs
 * nothing on a page that already asked.
 *
 * The route group name is in brackets, so none of these URLs change.
 */
export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const viewer = await getViewer();

  return (
    <>
      {viewer ? <WorkspaceChrome /> : <SiteHeader />}
      {children}
    </>
  );
}
