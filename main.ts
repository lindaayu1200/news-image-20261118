// Validate the bundled PNG front page and stage it for the make.fun bounty.
// Runs directly under Node 22's TypeScript support: node main.ts

import { copyFile, mkdir, open, stat } from 'node:fs/promises';
import type { Stats } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_BYTES = 1048576;
const PNG_SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

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

async function readHeader(path: string): Promise<Uint8Array> {
  const handle = await open(path, 'r');
  try {
    const buffer = Buffer.alloc(PNG_SIGNATURE.length);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return new Uint8Array(buffer.buffer, buffer.byteOffset, bytesRead);
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
  if (
    header.length !== PNG_SIGNATURE.length ||
    !PNG_SIGNATURE.every((byte, index) => header[index] === byte)
  ) {
    fail(`entry.png does not begin with the ${PNG_SIGNATURE.length}-byte PNG signature`);
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
