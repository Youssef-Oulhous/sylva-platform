'use server';

import { getLocale } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { redirectTo } from '@/lib/i18n/navigate';
import { readAs, withActor } from '@/lib/db/session';
import { requireActor } from '@/lib/auth/guards';
import type { Viewer } from '@/lib/auth/session';
import { DocumentError, codeForDocumentError, logDocumentFailure, type DocumentErrorCode } from './errors';
import { normaliseMediaType } from './media';
import { uploadDocument } from './service';
import { DOCUMENT_VISIBILITIES, OWNER_SETTABLE_VISIBILITIES, type DocumentVisibility } from './types';

/**
 * Uploading and withdrawing, as Server Actions.
 *
 * WHY A SERVER ACTION AND NOT A POST ROUTE HANDLER. Both can take a multipart
 * body. Only one of them is protected against cross-site submission out of the
 * box: Next.js checks Origin against Host for every Server Action, and a form
 * posted from another site is rejected before this code runs. A POST route
 * handler accepting multipart/form-data is a CSRF target - a hidden form on any
 * page could make a signed-in owner upload a file to its own project. This
 * platform has no token endpoint and no client JavaScript on these forms, so
 * the action's own check is the protection, and building the upload as a route
 * handler would have meant reimplementing it worse.
 *
 * The rest of the shape is src/lib/owner/actions.ts's, for the same reasons:
 * zod on the server over the FormData, failure ends in a redirect carrying an
 * error CODE and never the person's input, and the form needs no JavaScript.
 *
 * THE GUARD IS NOT THE BOUNDARY. requireActor() only decides what the page
 * does next. The boundary is the INSERT running as sylva_project_owner or
 * sylva_operator under the policies in migration 0055, which test
 * proj.is_owned_by_actor(). An error from there arrives as 42501 and becomes
 * "You don't have access to this information", which is the truthful sentence.
 */

function isRedirectError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && 'digest' in err
    && typeof (err as { digest: unknown }).digest === 'string'
    && (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}

function back(
  locale: string,
  slug: string,
  outcome: { error: DocumentErrorCode } | { saved: 'uploaded' | 'withdrawn' },
): never {
  const query = 'error' in outcome
    ? { error: outcome.error, section: 'documents' }
    : { saved: outcome.saved, section: 'documents' };
  redirectTo({ href: { pathname: `/owner/projects/${slug}`, query }, locale });
}

/* ----------------------------------------------------------------- UPLOAD */

const uploadSchema = z.object({
  slug: z.string().trim().min(1).max(200),
  kind: z.string().trim().min(1).max(64),
  visibility: z.enum(
    OWNER_SETTABLE_VISIBILITIES as unknown as [DocumentVisibility, ...DocumentVisibility[]],
  ),
  locale: z.string().trim().max(8).nullable(),
});

/**
 * Attach a document to a project this organisation owns.
 *
 * `kind` is checked against doc.document_kind rather than against a list in
 * this file: the reference table is the list, an operator maintains it, and a
 * copy here would be one more thing to keep in step. An unknown kind fails the
 * foreign key and becomes 'unknown_reference'.
 *
 * `visibility` is checked against the three classes an owner may set, twice:
 * by the enum above, so the form cannot submit 'admin', and by the row policy
 * in migration 0055, which is what actually enforces it.
 */
export async function uploadProjectDocumentAction(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const viewer = await requireActor();

  const slugRaw = String(formData.get('slug') ?? '');
  const parsed = uploadSchema.safeParse({
    slug: slugRaw,
    kind: formData.get('kind'),
    visibility: formData.get('visibility'),
    locale: formData.get('documentLocale') || null,
  });
  if (!parsed.success) back(locale, slugRaw, { error: 'invalid_input' });

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    back(locale, parsed.data.slug, { error: 'file_empty' });
  }

  // The browser's Content-Type comes from the file NAME. It is a claim, and
  // media.ts checks it against the bytes. Never a fact.
  const claimedType = normaliseMediaType(file.type || 'application/octet-stream');
  const bytes = Buffer.from(await file.arrayBuffer());

  let outcome: { error: DocumentErrorCode } | { saved: 'uploaded' };
  try {
    const projectId = await ownProjectId(viewer, parsed.data.slug);
    if (!projectId) {
      // The same sentence for "not yours" and "does not exist". A distinction
      // here would tell an owner which slugs other organisations hold.
      outcome = { error: 'no_access' };
    } else {
      await uploadDocument(viewer.actor, {
        kind: parsed.data.kind,
        visibility: parsed.data.visibility,
        locale: parsed.data.locale,
        mediaType: claimedType,
        bytes,
        anchor: { scope: 'project', projectId },
      });
      outcome = { saved: 'uploaded' };
    }
  } catch (err) {
    if (isRedirectError(err)) throw err;
    logDocumentFailure('uploadProjectDocumentAction', err, { slug: parsed.data.slug });
    outcome = {
      error: err instanceof DocumentError ? err.code : codeForDocumentError(err),
    };
  }

  revalidatePath('/owner');
  revalidatePath(`/projects/${parsed.data.slug}`);
  back(locale, parsed.data.slug, outcome);
}

/* --------------------------------------------------------------- WITHDRAW */

const withdrawSchema = z.object({
  slug: z.string().trim().min(1).max(200),
  versionId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
});

/**
 * Withdraw one version.
 *
 * Not a delete, and there is no delete. The row and its content hash stay for
 * the auditor and for any record entry that cited the document; what changes
 * is that every serving route stops finding it. doc.document_withdrawal is
 * append-only, so a withdrawal is itself permanent - which is why the reason is
 * required and is stored.
 */
export async function withdrawDocumentVersionAction(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const viewer = await requireActor();

  const slugRaw = String(formData.get('slug') ?? '');
  const parsed = withdrawSchema.safeParse({
    slug: slugRaw,
    versionId: formData.get('versionId'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) back(locale, slugRaw, { error: 'invalid_input' });

  let outcome: { error: DocumentErrorCode } | { saved: 'withdrawn' };
  try {
    await withActor(viewer.actor, async (tx) => {
      await tx.query(
        `INSERT INTO doc.document_withdrawal
           (document_version_id, reason, withdrawn_by_org_id)
         VALUES ($1::uuid, $2, sylva.actor_org_id())`,
        [parsed.data.versionId, parsed.data.reason],
      );
    });
    outcome = { saved: 'withdrawn' };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    logDocumentFailure('withdrawDocumentVersionAction', err, { slug: parsed.data.slug });
    outcome = { error: codeForDocumentError(err) };
  }

  revalidatePath('/owner');
  revalidatePath(`/projects/${parsed.data.slug}`);
  back(locale, parsed.data.slug, outcome);
}

/* ------------------------------------------------------------------ small */

async function ownProjectId(viewer: Viewer, slug: string): Promise<string | null> {
  const row = await readAs(viewer.actor, (tx) => tx.maybe<{ id: string }>(
    `SELECT id FROM proj.project
      WHERE slug = $1 AND owner_org_id = sylva.actor_org_id()`,
    [slug],
  ));
  return row?.id ?? null;
}

/** The kinds an owner may choose, from the reference table. */
export async function documentKinds(): Promise<{ code: string; labelEn: string }[]> {
  const viewer = await requireActor();
  return readAs(viewer.actor, async (tx) => {
    const rows = await tx.query<{ code: string; label_en: string }>(
      'SELECT code, label_en FROM doc.document_kind ORDER BY label_en',
    );
    return rows.map((r) => ({ code: r.code, labelEn: r.label_en }));
  });
}

/** Every visibility class, for an operator's form. Owners get three. */
export async function allVisibilities(): Promise<readonly DocumentVisibility[]> {
  return DOCUMENT_VISIBILITIES;
}
