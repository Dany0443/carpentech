import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { Script } from 'node:vm';
import { parse as parseCSS } from 'css-tree';
import postcss from 'postcss';
import { HtmlValidate } from 'html-validate';
import { parse as parseHTML } from 'parse5';
import { XMLValidator } from 'fast-xml-parser';

// Exclude dependencies, tool installations and generated output, not all dotfolders.
const excluded = new Set([
  '.git', '.agents', '.codex', '.aws', '.taste', '.taste-skill', '.impeccable',
  'node_modules', 'dist', 'test-results', 'playwright-report', 'graphify-out',
]);
const extensions = new Set(['.js', '.mjs', '.cjs', '.css', '.html', '.json', '.webmanifest', '.svg']);
const htmlValidator = new HtmlValidate({
  extends: ['html-validate:recommended', 'html-validate:prettier'],
  // Inline styles have valid HTML syntax; validate their CSS below.
  rules: { 'no-inline-style': 'off' },
});

export async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (entry.isFile() && extensions.has(extname(path).toLowerCase())) files.push(path);
  }
  return files.sort();
}

function checkJavaScript(source, filename, module = false) {
  if (module) {
    execFileSync(process.execPath, ['--check', '--input-type=module'], {
      input: source, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    });
  } else {
    new Script(source, { filename });
  }
}

function checkCSS(source, context = 'stylesheet') {
  // css-tree recovers at EOF; PostCSS also rejects unclosed blocks/strings.
  postcss.parse(context === 'declarationList' ? `a { ${source} }` : source);
  const errors = [];
  parseCSS(source, { context, onParseError: (error) => errors.push(error.message) });
  assert.deepEqual(errors, [], 'CSS must parse without recovery');
}

async function checkHTML(source, file) {
  const report = await htmlValidator.validateString(source, file);
  assert.equal(report.valid, true, JSON.stringify(report.results.flatMap((result) => result.messages), null, 2));

  function visit(node) {
    const attributes = Object.fromEntries((node.attrs ?? []).map(({ name, value }) => [name, value]));
    const content = (node.childNodes ?? []).map((child) => child.value ?? '').join('');
    if (node.tagName === 'script' && !('src' in attributes)) {
      const type = (attributes.type ?? '').trim().toLowerCase();
      if (['application/ld+json', 'application/json', 'importmap', 'speculationrules'].includes(type)) {
        JSON.parse(content);
      } else if (!type || type === 'module' || /^(text|application)\/(javascript|ecmascript)$/.test(type)) {
        checkJavaScript(content, `${file}:inline-script`, type === 'module');
      }
    }
    if (node.tagName === 'style') checkCSS(content);
    if ('style' in attributes) checkCSS(attributes.style, 'declarationList');
    for (const child of node.childNodes ?? []) visit(child);
    if (node.content) visit(node.content); // Template contents live in a separate fragment.
  }
  visit(parseHTML(source));
}

export async function validateFile(file) {
  const extension = extname(file).toLowerCase();
  const source = await readFile(file, 'utf8');
  if (['.js', '.mjs', '.cjs'].includes(extension)) {
    execFileSync(process.execPath, ['--check', file], { stdio: ['pipe', 'pipe', 'pipe'] });
  } else if (['.json', '.webmanifest'].includes(extension)) {
    JSON.parse(source);
  } else if (extension === '.css') {
    checkCSS(source);
  } else if (extension === '.svg') {
    const result = XMLValidator.validate(source);
    assert.equal(result, true, JSON.stringify(result));
    assert.match(source, /<svg(?:\s|>)/, 'SVG must contain an svg element');
  } else if (extension === '.html') {
    await checkHTML(source, file);
  } else {
    assert.fail(`No syntax validator for ${file}`);
  }
}
