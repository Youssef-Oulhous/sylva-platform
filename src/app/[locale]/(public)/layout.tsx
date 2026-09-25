import SiteHeader from '@/components/SiteHeader';

/**
 * The public shell: the marketing header, for someone who has not decided
 * anything yet. Everything a signed-out visitor is meant to read lives under
 * this group, and so do the two entry forms, because a person filling in
 * /sign-in or /register is still a visitor.
 *
 * The route group name is in brackets, so none of these URLs change.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
