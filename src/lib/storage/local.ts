import { createReadStream } from 'node:fs';
import { mkdir, rename, rm, stat, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import {
  assertValidBucket,
  assertValidStorageKey,
  StorageKeyInUseError,
  InvalidStorageKeyError,
  type OpenedObject,
  type StorageDriver,
  type StorageRef,
} from './types';

/**
 * The development driver: one directory tree under .storage.
 *
 * It is a stub in the sense that it is not durable, not replicated and not in
 * anybody's data centre. It is NOT a stub in the sense that matters here: it
 * enforces the same three properties as the real thing, so a bug that would be
 * a data-protection incident in production is a failing test on a laptop.
 *
 *   - No overwrite. `put` opens with 'wx'; an existing key is an error.
 *   - No traversal. The key is validated by character class, then the resolved
 *     absolute path is checked to lie under <root>/<bucket>/. Either check
 *     alone would probably do; having both is why a mistake in one is not an
 *     escape.
 *   - No public URL. There is no route that maps a request path to this
 *     directory, and .storage sits outside public/, which is the only
 *     directory Next.js serves as files. A visitor who guesses a storage key
 *     has guessed a string that no HTTP route accepts.
 *
 * Writes are atomic: bytes go to a temporary name in the same directory and
 * are then renamed. A half-written file can therefore never be served as a
 * complete document after a crash mid-upload.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local';

  constructor(
    private readonly root: string,
    readonly region: string,
    readonly bucket: string,
  ) {
    assertValidBucket(bucket);
  }

  /** The absolute path for a ref, or a throw. The only place paths are built. */
  private pathFor(ref: StorageRef): string {
    assertValidBucket(ref.bucket);
    assertValidStorageKey(ref.key);

    const base = resolve(this.root, ref.bucket);
    const full = resolve(base, ...ref.key.split('/'));

    // Second, independent check. resolve() has already collapsed any '..' that
    // slipped past the character class, so this comparison is on the real path.
    if (full !== base && !full.startsWith(base + sep)) {
      throw new InvalidStorageKeyError(ref.key);
    }
    return full;
  }

  async put(key: string, bytes: Buffer): Promise<void> {
    const target = this.pathFor({ bucket: this.bucket, key });
    const dir = target.slice(0, target.lastIndexOf(sep));
    await mkdir(dir, { recursive: true });

    const temp = join(dir, `.incoming-${randomBytes(12).toString('hex')}`);
    try {
      // 'wx' on the temp name too: a collision here is a bug, not a retry.
      await writeFile(temp, bytes, { flag: 'wx', mode: 0o600 });
      if (await this.size({ bucket: this.bucket, key }) !== null) {
        throw new StorageKeyInUseError({ bucket: this.bucket, key });
      }
      await rename(temp, target);
    } catch (err) {
      await rm(temp, { force: true }).catch(() => { /* best effort */ });
      throw err;
    }
  }

  async open(ref: StorageRef): Promise<OpenedObject | null> {
    const path = this.pathFor(ref);
    const info = await stat(path).catch(() => null);
    if (!info || !info.isFile()) return null;
    return {
      byteSize: info.size,
      stream: Readable.toWeb(
        createReadStream(path),
      ) as unknown as ReadableStream<Uint8Array>,
    };
  }

  async read(ref: StorageRef): Promise<Buffer | null> {
    return readFile(this.pathFor(ref)).catch(() => null);
  }

  async size(ref: StorageRef): Promise<number | null> {
    const info = await stat(this.pathFor(ref)).catch(() => null);
    return info && info.isFile() ? info.size : null;
  }

  async remove(ref: StorageRef): Promise<void> {
    await rm(this.pathFor(ref), { force: true });
  }
}
