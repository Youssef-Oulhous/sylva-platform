/**
 * Object storage, expressed as the smallest interface that can be satisfied by
 * a local directory in development and by an S3-compatible EU endpoint in a
 * deployment.
 *
 * Three properties the interface is shaped to protect, none of them optional:
 *
 *   PRIVATE. There is no `publicUrl()` and there never will be. A document is
 *   reached by calling `open()` AFTER a server-side authorisation check has
 *   already passed. The concept note's worst case is one buyer seeing another
 *   buyer's terms; a public bucket URL would make the row-level policies
 *   decorative, because the bytes would be reachable without ever touching a
 *   policy.
 *
 *   EU-RESIDENT. Every write records the `platform.storage_region` code it
 *   landed in, and that column is a foreign key to a table whose member_state
 *   is a foreign key to platform.eu_member_state. A London or Zurich region is
 *   a constraint violation rather than a policy. `region` below is what gets
 *   written, so a misconfigured driver fails at INSERT, loudly, rather than
 *   silently parking a project design document outside the EU.
 *
 *   APPEND-ONLY. `put()` refuses to overwrite an existing key, because
 *   doc.document_version is append-only and a key is never reused
 *   (UNIQUE (storage_bucket, storage_key) in migration 0010). Repointing a
 *   stored version at other bytes would let a "corrected" document change what
 *   an old record entry cited, which is exactly what R4 exists to prevent.
 *
 * `remove()` is the one exception and it is deliberately narrow: it exists so
 * that an upload whose DATABASE insert failed does not leave an orphan blob.
 * See the ordering argument in src/lib/documents/service.ts. It must never be
 * called for a key that a doc.document_version row points at.
 */

export interface StorageRef {
  readonly bucket: string;
  readonly key: string;
}

export interface OpenedObject {
  /** The size the store reports, which the caller compares with the recorded
   *  byte_size before serving a single byte. */
  readonly byteSize: number;
  /** A web stream, so a Route Handler can return it without buffering a
   *  40 MB design document into the server's heap. */
  readonly stream: ReadableStream<Uint8Array>;
}

export interface StorageDriver {
  /** 'local' or 's3'. Appears in logs and in the upload's error messages. */
  readonly name: string;
  /** The platform.storage_region code written to doc.document_version. */
  readonly region: string;
  /** The bucket new uploads land in. Reads use the bucket recorded on the row. */
  readonly bucket: string;

  /**
   * Write bytes at a key that does not yet exist.
   * @throws {StorageKeyInUseError} if the key exists. Never overwrites.
   */
  put(key: string, bytes: Buffer): Promise<void>;

  /** A stream, or null when the store holds nothing at that key. */
  open(ref: StorageRef): Promise<OpenedObject | null>;

  /** The whole object, for hashing and for small files. Null when absent. */
  read(ref: StorageRef): Promise<Buffer | null>;

  /** Size in bytes, or null when absent. Cheap: no body is transferred. */
  size(ref: StorageRef): Promise<number | null>;

  /** ONLY for rolling back an upload whose database insert failed. */
  remove(ref: StorageRef): Promise<void>;
}

export class StorageKeyInUseError extends Error {
  constructor(readonly ref: StorageRef) {
    super(`storage key already in use: ${ref.bucket}/${ref.key}`);
    this.name = 'StorageKeyInUseError';
  }
}

export class InvalidStorageKeyError extends Error {
  constructor(value: string) {
    // The offending value is NOT interpolated: this message reaches a log, and
    // a crafted key is exactly the kind of string one does not want echoed.
    super(`rejected storage key (${value.length} characters)`);
    this.name = 'InvalidStorageKeyError';
  }
}

/**
 * What a key is allowed to look like, checked on the way in AND on the way out.
 *
 * This is the traversal guard, and it is a whitelist rather than a blacklist of
 * '..' because a blacklist has to anticipate every encoding. A key is a
 * slash-separated path of segments drawn from [A-Za-z0-9._-], no segment empty,
 * no segment '.' or '..', no leading or trailing slash, 1024 characters at
 * most. A backslash, a NUL, a percent escape and an absolute path all fail the
 * character class before any resolution happens.
 *
 * The local driver ALSO re-checks the resolved path against its root, because
 * two independent checks is the point: this one can be wrong.
 */
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function assertValidStorageKey(key: string): void {
  if (typeof key !== 'string' || key.length === 0 || key.length > 1024) {
    throw new InvalidStorageKeyError(String(key));
  }
  const segments = key.split('/');
  if (segments.length > 16) throw new InvalidStorageKeyError(key);
  for (const s of segments) {
    if (!SEGMENT.test(s) || s === '.' || s === '..') {
      throw new InvalidStorageKeyError(key);
    }
  }
}

/** Buckets follow the S3 naming rules, which are stricter than keys. */
const BUCKET = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

export function assertValidBucket(bucket: string): void {
  if (typeof bucket !== 'string' || !BUCKET.test(bucket) || bucket.includes('..')) {
    throw new InvalidStorageKeyError(String(bucket));
  }
}
