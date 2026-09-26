import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth/session';
import WorkspaceChrome from '@/components/workspace/WorkspaceChrome';

/**
 * The signed-in areas.
 *
 * The header itself lives in WorkspaceChrome, because the public pages need
 * exactly the same one: a person who has signed in keeps their own navigation
 * wherever they go, including on /projects and the marketing pages. All that
 * is left here is the rule that these particular routes are for signed-in
 * people only.
 *
 * This is presentation, not security. Each page keeps its own guard, and the
 * real boundary is the database role the session is served by.
 */
export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const viewer = await getViewer();
  if (!viewer) redirect(`/${locale}/sign-in`);

  return (
    <>
      <WorkspaceChrome />
      {children}
    </>
  );
}
