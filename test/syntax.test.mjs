import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { sourceFiles, validateFile } from './syntax-helpers.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
for (const file of await sourceFiles(root)) {
  test(`valid syntax: ${relative(root, file)}`, () => validateFile(file));
}
