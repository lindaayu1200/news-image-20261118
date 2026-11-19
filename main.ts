// Validate the bundled PNG front page and stage it for the make.fun bounty.
// Runs directly under Node 22's TypeScript support: node main.ts
//
// Checks: regular file <= 1 MiB, PNG signature, and 1024x1024 IHDR dimensions.

import { copyFile, mkdir, open, stat } from 'node:fs/promises';
import type { Stats } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_BYTES = 1048576;
const EXPECTED_WIDTH = 1024;
const EXPECTED_HEIGHT = 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const IHDR_TYPE = Buffer.from('IHDR', 'ascii');
// Signature (8 bytes) + IHDR length (4), type (4) and width/height (4 + 4).
const HEADER_BYTES = PNG_SIGNATURE.length + 16;

function fail(message: string): never {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function inspect(path: string): Promise<Stats> {
  try {
    return await stat(path);
  } catch (error) {
    fail(`cannot access ${path}: ${describe(error)}`);
  }
}

async function readHeader(path: string): Promise<Buffer> {
  const handle = await open(path, 'r');
  try {
    const buffer = Buffer.alloc(HEADER_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead);
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

  const header = await readHeader(entryPath);
  const signature = header.subarray(0, PNG_SIGNATURE.length);
  if (signature.length !== PNG_SIGNATURE.length || !signature.equals(PNG_SIGNATURE)) {
    fail(
      `entry.png does not begin with the ${PNG_SIGNATURE.length}-byte PNG signature; found ${signature.toString('hex')}`,
    );
  }

  if (header.length < HEADER_BYTES) {
    fail(`entry.png is too short (${header.length} bytes) to contain a PNG IHDR header`);
  }
  if (header.readUInt32BE(PNG_SIGNATURE.length) < 13) {
    fail('entry.png has an invalid IHDR chunk length');
  }
  if (
    !header.subarray(PNG_SIGNATURE.length + 4, PNG_SIGNATURE.length + 8).equals(IHDR_TYPE)
  ) {
    fail('entry.png has no IHDR chunk after its PNG signature');
  }

  const width = header.readUInt32BE(PNG_SIGNATURE.length + 8);
  const height = header.readUInt32BE(PNG_SIGNATURE.length + 12);
  if (width !== EXPECTED_WIDTH || height !== EXPECTED_HEIGHT) {
    fail(
      `entry.png is ${width}x${height} pixels; expected ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}`,
    );
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

  console.log(`Success: copied entry.png (${info.size} bytes) to ${destination}`);
}

try {
  await run();
} catch (error) {
  fail(describe(error));
}
