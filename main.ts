// main.ts — validate the finished news poster and hand it to the grader.
//
// On every run this script:
//   1. confirms entry.png exists and is at most 1 MiB (1048576 bytes),
//   2. confirms its first eight bytes are the PNG signature, and
//   3. copies it to $MAKEFUN_OUTPUT_DIR/entry.png (default: /output/entry.png).
//
// Node 22 standard library only; no third-party dependencies.

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
  fail(`cannot stat entry.png at ${source.pathname}`);
}
if (size > MAX_BYTES) {
  fail(`entry.png is ${size} bytes (limit ${MAX_BYTES})`);
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
  fail(`cannot read entry.png at ${source.pathname}`);
}
if (
  bytesRead !== PNG_SIGNATURE.length ||
  !header.subarray(0, bytesRead).equals(PNG_SIGNATURE)
) {
  fail('invalid PNG signature in entry.png');
}

mkdirSync(outputDir, { recursive: true });
// Deliver the validated image to the grader's output directory.
copyFileSync(source, join(outputDir, 'entry.png'));

console.log(`main.ts: validated entry.png (${size} bytes) and copied it to ${join(outputDir, 'entry.png')}`);
