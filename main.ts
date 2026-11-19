// Validate the bundled PNG front page and stage it for the make.fun bounty.
// Runs directly under Node 22's TypeScript support: node main.ts
//
// Checks: regular file <= 1 MiB, PNG signature, 1024x1024 IHDR with a valid
// CRC, and a terminating IEND chunk; then copies entry.png byte-for-byte.

import { copyFile, mkdir, open, stat } from 'node:fs/promises';
import type { Stats } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_BYTES = 1048576;
const EXPECTED_WIDTH = 1024;
const EXPECTED_HEIGHT = 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const IHDR_TYPE = Buffer.from('IHDR', 'ascii');
const IHDR_DATA_BYTES = 13;
// The final 12 bytes of a PNG: length 0, type "IEND", CRC AE426082.
const IEND_CHUNK = Buffer.from([
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

const LENGTH_OFFSET = PNG_SIGNATURE.length;
const TYPE_OFFSET = LENGTH_OFFSET + 4;
const IHDR_DATA_OFFSET = TYPE_OFFSET + 4;
const IHDR_CRC_OFFSET = IHDR_DATA_OFFSET + IHDR_DATA_BYTES;
// Signature, IHDR length/type/data, and the IHDR CRC.
const HEADER_BYTES = IHDR_CRC_OFFSET + 4;

function fail(message: string): never {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// PNG chunk CRCs are CRC-32 with the IEEE 802.3 polynomial, over type + data.
function crc32(bytes: Buffer, start: number, end: number): number {
  let crc = 0xffffffff;
  for (let i = start; i < end; i += 1) {
    crc ^= bytes[i]!;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function inspect(path: string): Promise<Stats> {
  try {
    return await stat(path);
  } catch (error) {
    fail(`cannot access ${path}: ${describe(error)}`);
  }
}

async function readEnds(path: string, size: number): Promise<{ header: Buffer; tail: Buffer }> {
  const handle = await open(path, 'r');
  try {
    const header = Buffer.alloc(HEADER_BYTES);
    const head = await handle.read(header, 0, header.length, 0);
    const tail = Buffer.alloc(IEND_CHUNK.length);
    const end = await handle.read(tail, 0, tail.length, size - tail.length);
    return {
      header: header.subarray(0, head.bytesRead),
      tail: tail.subarray(0, end.bytesRead),
    };
  } finally {
    await handle.close();
  }
}

async function run(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const entryPath = join(here, 'entry.png');

  const info = await inspect(entryPath);

  if (!info.isFile()) {
    fail(`entry.png is not a regular file: ${entryPath}`);
  }

  if (info.size > MAX_BYTES) {
    fail(`entry.png is ${info.size} bytes, which exceeds the ${MAX_BYTES}-byte limit`);
  }

  if (info.size < HEADER_BYTES + IEND_CHUNK.length) {
    fail(`entry.png is too short (${info.size} bytes) to contain a PNG header and IEND chunk`);
  }

  const { header, tail } = await readEnds(entryPath, info.size);
  const signature = header.subarray(0, PNG_SIGNATURE.length);
  if (signature.length !== PNG_SIGNATURE.length || !signature.equals(PNG_SIGNATURE)) {
    fail(
      `entry.png does not begin with the ${PNG_SIGNATURE.length}-byte PNG signature; found ${signature.toString('hex')}`,
    );
  }

  if (header.length < HEADER_BYTES) {
    fail(`entry.png is too short (${header.length} bytes) to contain a full PNG IHDR chunk`);
  }

  const ihdrLength = header.readUInt32BE(LENGTH_OFFSET);
  if (ihdrLength !== IHDR_DATA_BYTES) {
    fail(`entry.png has an IHDR chunk length of ${ihdrLength}; expected ${IHDR_DATA_BYTES}`);
  }
  if (!header.subarray(TYPE_OFFSET, TYPE_OFFSET + IHDR_TYPE.length).equals(IHDR_TYPE)) {
    fail('entry.png has no IHDR chunk after its PNG signature');
  }

  const width = header.readUInt32BE(IHDR_DATA_OFFSET);
  const height = header.readUInt32BE(IHDR_DATA_OFFSET + 4);
  if (width !== EXPECTED_WIDTH || height !== EXPECTED_HEIGHT) {
    fail(
      `entry.png is ${width}x${height} pixels; expected ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}`,
    );
  }

  const storedCrc = header.readUInt32BE(IHDR_CRC_OFFSET);
  const actualCrc = crc32(header, TYPE_OFFSET, IHDR_CRC_OFFSET);
  if (storedCrc !== actualCrc) {
    fail(
      `entry.png has an invalid IHDR CRC (found 0x${storedCrc.toString(16).padStart(8, '0')}, expected 0x${actualCrc.toString(16).padStart(8, '0')})`,
    );
  }

  if (tail.length !== IEND_CHUNK.length || !tail.equals(IEND_CHUNK)) {
    fail(`entry.png does not end with a valid zero-length IEND chunk; found ${tail.toString('hex')}`);
  }

  const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  try {
    await mkdir(outputDir, { recursive: true });
  } catch (error) {
    fail(`cannot create output directory ${outputDir}: ${describe(error)}`);
  }

  const destination = join(outputDir, 'entry.png');
  try {
    await copyFile(entryPath, destination);
  } catch (error) {
    fail(`cannot copy entry.png to ${destination}: ${describe(error)}`);
  }

  console.log(
    `OK: The World Ledger (33 stories) — entry.png, 1024x1024 PNG, ${info.size} bytes, IHDR CRC + IEND verified; copied unchanged to ${destination}`,
  );
}

try {
  await run();
} catch (error) {
  fail(describe(error));
}
