import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import test from 'node:test';
import { sourceFiles, validateFile } from './syntax-helpers.mjs';

async function fixture(t, files) {
  const root = await mkdtemp(join(tmpdir(), 'carpentech-syntax-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [name, source] of Object.entries(files)) {
    const path = join(root, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, source);
  }
  return root;
}

test('discovers nested and hidden project sources while excluding generated and binary files', async (t) => {
  const included = ['pages/nested/page.html', '.config/settings.json', 'public/icon.svg', 'test/example.cjs', 'public/site.webmanifest'];
  const excluded = ['node_modules/broken.js', '.git/broken.js', '.agents/skill/broken.js', 'test-results/broken.json', 'dist/broken.js', 'public/photo.webp'];
  const root = await fixture(t, Object.fromEntries([...included, ...excluded].map((name) => [name, ''])));
  assert.deepEqual((await sourceFiles(root)).map((file) => relative(root, file)).sort(), included.sort());
});

for (const [name, source] of Object.entries({
  'broken.js': 'const = ;',
  'broken.mjs': 'export const = ;',
  'broken.cjs': 'module.exports = ;',
  'broken.json': '{"missing":}',
  'broken.webmanifest': '{"name":}',
  'broken.css': 'body { color red; }',
  'broken.svg': '<svg><path></svg>',
  'unclosed.css': 'body { color: red;',
  'unclosed-string.css': 'body { content: "oops; }',
  'broken.html': '<!doctype html><html><head><title>Test</title></head><body><div></span></body></html>',
})) {
  test(`rejects malformed ${name}`, async (t) => {
    const root = await fixture(t, { [name]: source });
    await assert.rejects(validateFile(join(root, name)), (error) => error.code !== 'EPERM');
  });
}

for (const [name, content] of Object.entries({
  'classic-script': '<script>const = ;</script>',
  'module-script': '<script type="module">export const = ;</script>',
  'json-script': '<script type="application/ld+json">{"name":}</script>',
  'style-block': '<style>body { color red; }</style>',
  'style-attribute': '<p style="color red;">Text</p>',
})) {
  test(`rejects invalid inline ${name}`, async (t) => {
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Test</title></head><body>${content}</body></html>`;
    const root = await fixture(t, { 'index.html': html });
    await assert.rejects(validateFile(join(root, 'index.html')));
  });
}

test('accepts module scripts, JSON data, styles, and script-like text in comments', async (t) => {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Test</title>
    <style>body { color: red; }</style></head><body>
    <!-- <script>const = ;</script> -->
    <script type="module">export const value = await Promise.resolve(1);</script>
    <script type="application/ld+json">{"name":"Test"}</script>
    <p style="color: red;">Text</p></body></html>`;
  const root = await fixture(t, { 'index.html': html, 'icon.svg': '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>' });
  for (const file of await sourceFiles(root)) await validateFile(file);
});
