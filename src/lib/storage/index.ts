import { resolve } from 'node:path';
import { LocalStorageDriver } from './local';
import type { StorageDriver } from './types';

export * from './types';
export { LocalStorageDriver } from './local';

/**
 * Which driver serves this process, decided once from the environment.
 *
 *   SYLVA_STORAGE_DRIVER=local   a directory under SYLVA_STORAGE_LOCAL_DIR
 *   SYLVA_STORAGE_DRIVER=s3      an S3-compatible endpoint in an EU region
 *
 * The region is not cosmetic. It is written to doc.document_version.
 * storage_region, which is a foreign key to platform.storage_region, whose
 * member_state is a foreign key to platform.eu_member_state. So a driver
 * configured with 'us-east-1' or with a generic 'eu' does not quietly work: the
 * first upload fails with a foreign-key violation. That is the intended
 * behaviour and it is why the region is read from the environment here rather
 * than defaulted somewhere deeper.
 */

const DEFAULT_REGION = 'eu-central-1'; // Frankfurt. A named member state, not "Europe".
const DEFAULT_BUCKET = 'sylva-documents';

let cached: StorageDriver | null = null;

export function storageDriver(): StorageDriver {
  cached ??= buildDriver();
  return cached;
}

/** Tests replace the driver; nothing in src/ may call this. */
export function __setStorageDriverForTests(driver: StorageDriver | null): void {
  cached = driver;
}

function buildDriver(): StorageDriver {
  const kind = (process.env.SYLVA_STORAGE_DRIVER ?? 'local').trim();
  const region = (process.env.SYLVA_S3_REGION || DEFAULT_REGION).trim();
  const bucket = (process.env.SYLVA_S3_BUCKET || DEFAULT_BUCKET).trim();

  if (kind === 'local') {
    const dir = process.env.SYLVA_STORAGE_LOCAL_DIR ?? './.storage';
    return new LocalStorageDriver(resolve(process.cwd(), dir), region, bucket);
  }

  if (kind === 's3') {
    // Deliberately a throw and not a half-driver.
    //
    // An S3 driver is about eighty lines against this interface - PutObject,
    // GetObject, HeadObject, DeleteObject, SigV4 - and it needs a decision
    // this repository has not been given: WHICH provider and which named
    // member-state region (docs/DECISIONS.md, and §12 of the README). Shipping
    // an unconfigured one that falls back to the local directory would put
    // uploaded documents on an application server's disk while every log line
    // said eu-central-1, which is the failure this message exists to prevent.
    throw new Error(
      'SYLVA_STORAGE_DRIVER=s3 is not implemented. Implement StorageDriver '
      + 'against the chosen EU provider in src/lib/storage/s3.ts and register '
      + 'it here. Do not fall back to the local driver in a deployment.',
    );
  }

  throw new Error(`unknown SYLVA_STORAGE_DRIVER: ${kind}`);
}
