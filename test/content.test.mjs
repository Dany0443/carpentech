import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../public/script.js', import.meta.url), 'utf8');

test('the source does not expose a complete email address or mailto destination', () => {
  const emailPattern = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
  assert.equal(emailPattern.test(html), false);
  assert.equal(emailPattern.test(script), false);
  assert.equal(html.includes('mailto:'), false);
});

test('motion follows the system without a site preference or toggle', () => {
  assert.equal(html.includes('data-motion-toggle'), false);
  assert.equal(script.includes('carpentech-motion'), false);
  assert.equal(html.includes('carpentech-motion'), false);
});
