// Copies the finished news poster into the grader's output directory.
// Node 22, standard library only. MAKEFUN_OUTPUT_DIR stands in for /output locally.

import { closeSync, copyFileSync, mkdirSync, openSync, readSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MAX_BYTES = 1048576;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const source = new URL('./entry.png', import.meta.url);

function fail(message: string): never {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

// entry.png must exist and be a regular file no larger than MAX_BYTES.
let size: number;
try {
  size = statSync(source).size;
} catch {
  fail(`entry.png does not exist or cannot be stat'ed at ${source.pathname}`);
}
if (size > MAX_BYTES) {
  fail(`entry.png is ${size} bytes, which exceeds the ${MAX_BYTES}-byte limit`);
}

// Its first eight bytes must be the PNG signature.
let header = Buffer.alloc(PNG_SIGNATURE.length);
let bytesRead = 0;
try {
  const fd = openSync(source, 'r');
  try {
    bytesRead = readSync(fd, header, 0, PNG_SIGNATURE.length, 0);
  } finally {
    closeSync(fd);
  }
} catch {
  fail(`entry.png exists but cannot be read at ${source.pathname}`);
}
if (
  bytesRead !== PNG_SIGNATURE.length ||
  !header.subarray(0, bytesRead).equals(PNG_SIGNATURE)
) {
  fail('entry.png is not a valid PNG: the first 8 bytes are not the PNG signature');
}

mkdirSync(outputDir, { recursive: true });
copyFileSync(source, join(outputDir, 'entry.png'));
