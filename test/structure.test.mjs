import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parse } from 'parse5';
import { sourceFiles } from './syntax-helpers.mjs';

const root = new URL('../', import.meta.url);
const origin = new URL('https://static.example/');

for (const file of (await sourceFiles(fileURLToPath(root))).filter((file) => file.endsWith('.html'))) {
  const name = relative(fileURLToPath(root), file);
  const nodes = [];
  function visit(node) {
    if (node.tagName) nodes.push({
      tag: node.tagName,
      attrs: Object.fromEntries(node.attrs.map(({ name, value }) => [name, value])),
    });
    for (const child of node.childNodes ?? []) visit(child);
  }
  visit(parse(await readFile(file, 'utf8')));
  const ids = nodes.flatMap(({ attrs }) => attrs.id ? [attrs.id] : []);

  test(`page structure: ${name}`, () => {
    for (const tag of ['html', 'head', 'title', 'body', 'main', 'h1']) {
      assert.equal(nodes.filter((node) => node.tag === tag).length, 1, `Expected one ${tag}`);
    }
    assert.ok(nodes.find((node) => node.tag === 'html').attrs.lang, 'Document needs a language');
    assert.equal(new Set(ids).size, ids.length, 'IDs must be unique');
    for (const { attrs } of nodes) {
      for (const attribute of ['aria-labelledby', 'aria-describedby', 'aria-controls', 'for']) {
        for (const id of (attrs[attribute] ?? '').split(/\s+/).filter(Boolean)) {
          assert.ok(ids.includes(id), `${attribute} references missing #${id}`);
        }
      }
    }
  });

  test(`local links and assets: ${name}`, async () => {
    const pageURL = new URL(name, origin);
    for (const { attrs } of nodes) {
      for (const attribute of ['href', 'src', 'poster']) {
        if (!attrs[attribute]) continue;
        const url = new URL(attrs[attribute], pageURL);
        if (url.origin !== origin.origin) continue;
        if (url.pathname === pageURL.pathname && url.hash) {
          assert.ok(ids.includes(decodeURIComponent(url.hash.slice(1))), `Missing target ${url.hash}`);
        }
        const target = new URL(`.${url.pathname}`, root);
        const info = await stat(target);
        assert.ok(info.isFile() || info.isDirectory(), `Missing local resource: ${url.pathname}`);
        if (info.isDirectory()) await stat(new URL(`${target.href.replace(/\/$/, '')}/index.html`));
      }
    }
  });
}
