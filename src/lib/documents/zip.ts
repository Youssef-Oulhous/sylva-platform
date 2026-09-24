/**
 * A ZIP writer, store-only, about a hundred lines.
 *
 * WHY NOT A LIBRARY. The README's rule is that a new dependency is announced
 * loudly, and this is the whole of what a bulk download needs: no compression
 * (a PDF and an XLSX are already deflated, so compressing them buys nothing and
 * costs CPU per request), no encryption, no zip64, no directory entries. A
 * dependency here would be several thousand lines of code, most of it parsing
 * archives written by other people, in a process that serves other
 * organisations' documents. Ninety lines that only ever WRITE is the smaller
 * risk.
 *
 * WHY IT STREAMS. The bulk download of a project's register can be four PDFs
 * of forty megabytes. Building the archive in memory would be 160 MB of heap
 * per concurrent request. This yields chunk by chunk and holds one file at a
 * time, so peak memory is the size of the largest member.
 *
 * WHAT IT DOES NOT DO. No zip64, so the archive and every member must be under
 * 4 GiB; `buildZip` refuses beyond that rather than writing a header that lies.
 * Names are ASCII, built by the caller from the document kind and version - see
 * keys.ts - so the UTF-8 name flag is not needed and a hostile file name cannot
 * get in.
 */

export interface ZipMember {
  /** The name inside the archive. ASCII, no leading slash, no '..'. */
  readonly name: string;
  /** Called once, when this member's turn comes. */
  readonly bytes: () => Promise<Buffer>;
  readonly modified?: Date;
}

const MAX_TOTAL = 4 * 1024 * 1024 * 1024 - 1; // zip64 begins here.

/* ------------------------------------------------------------------ CRC -- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/* ----------------------------------------------------------- MS-DOS time -- */

function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getUTCFullYear());
  return {
    time: (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5)
      | (Math.floor(date.getUTCSeconds() / 2)),
    date: ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate(),
  };
}

/* ---------------------------------------------------------------- write -- */

interface Recorded {
  name: Buffer;
  crc: number;
  size: number;
  offset: number;
  time: number;
  date: number;
}

function localHeader(name: Buffer, r: Omit<Recorded, 'name' | 'offset'>): Buffer {
  const head = Buffer.alloc(30);
  head.writeUInt32LE(0x04034b50, 0);   // local file header signature
  head.writeUInt16LE(20, 4);           // version needed: 2.0
  head.writeUInt16LE(0, 6);            // flags: none. No data descriptor.
  head.writeUInt16LE(0, 8);            // method 0: stored
  head.writeUInt16LE(r.time, 10);
  head.writeUInt16LE(r.date, 12);
  head.writeUInt32LE(r.crc, 14);
  head.writeUInt32LE(r.size, 18);      // compressed
  head.writeUInt32LE(r.size, 22);      // uncompressed
  head.writeUInt16LE(name.length, 26);
  head.writeUInt16LE(0, 28);           // extra field length
  return Buffer.concat([head, name]);
}

function centralEntry(r: Recorded): Buffer {
  const head = Buffer.alloc(46);
  head.writeUInt32LE(0x02014b50, 0);   // central directory header signature
  head.writeUInt16LE(20, 4);           // version made by
  head.writeUInt16LE(20, 6);           // version needed
  head.writeUInt16LE(0, 8);
  head.writeUInt16LE(0, 10);           // stored
  head.writeUInt16LE(r.time, 12);
  head.writeUInt16LE(r.date, 14);
  head.writeUInt32LE(r.crc, 16);
  head.writeUInt32LE(r.size, 20);
  head.writeUInt32LE(r.size, 24);
  head.writeUInt16LE(r.name.length, 28);
  head.writeUInt16LE(0, 30);           // extra
  head.writeUInt16LE(0, 32);           // comment
  head.writeUInt16LE(0, 34);           // disk number
  head.writeUInt16LE(0, 36);           // internal attributes
  head.writeUInt32LE(0, 38);           // external attributes
  head.writeUInt32LE(r.offset, 42);
  return Buffer.concat([head, r.name]);
}

function endOfCentralDirectory(count: number, size: number, offset: number): Buffer {
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);             // this disk
  end.writeUInt16LE(0, 6);             // disk with central directory
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(size, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);            // comment length
  return end;
}

/** A web stream of the finished archive. Members are read one at a time. */
export function zipStream(members: readonly ZipMember[]): ReadableStream<Uint8Array> {
  let index = 0;
  let offset = 0;
  const recorded: Recorded[] = [];
  let finished = false;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (index < members.length) {
        const member = members[index]!;
        index += 1;

        const bytes = await member.bytes();
        const name = Buffer.from(safeName(member.name), 'ascii');
        const { time, date } = dosDateTime(member.modified ?? new Date());
        const entry = {
          crc: crc32(bytes), size: bytes.length, time, date,
        };

        if (offset + 30 + name.length + bytes.length > MAX_TOTAL) {
          controller.error(new Error('archive would exceed the 4 GiB zip limit'));
          return;
        }

        const header = localHeader(name, entry);
        controller.enqueue(header);
        controller.enqueue(bytes);
        recorded.push({ ...entry, name, offset });
        offset += header.length + bytes.length;
        return;
      }

      if (!finished) {
        finished = true;
        const directoryOffset = offset;
        let directorySize = 0;
        for (const r of recorded) {
          const entry = centralEntry(r);
          controller.enqueue(entry);
          directorySize += entry.length;
        }
        controller.enqueue(
          endOfCentralDirectory(recorded.length, directorySize, directoryOffset),
        );
        controller.close();
      }
    },
  });
}

/** Names are built by us, but this is the last line before a byte stream. */
function safeName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+/, '');
  return cleaned.length > 0 ? cleaned.slice(0, 200) : 'document';
}
