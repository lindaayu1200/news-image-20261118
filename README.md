# World Wire — 18 November 2026 front page

An entry for the make.fun bounty **news-image-20261118**. It is a single image summing up the world news of 18 November 2026: 37 stories from six continents, anchored by a locator map so every headline has a place.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Node 22 runs `main.ts` directly. The script validates `entry.png` (regular file, at most 1048576 bytes, valid PNG signature) and copies it to `$MAKEFUN_OUTPUT_DIR` (default `/output`).

## License

MIT.
