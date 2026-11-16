import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';
import { parse } from 'parse5';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

const root = new URL('../', import.meta.url);
const origin = 'https://team-carpen.tech';
const pages = [
  { file: 'index.html', path: '/', type: 'WebPage' },
  { file: 'decode/index.html', path: '/decode/', type: 'CollectionPage' },
];
const titles = new Set();
const descriptions = new Set();

for (const { file, path, type } of pages) {
  const document = parse(await readFile(new URL(file, root), 'utf8'));
  const nodes = [];
  function visit(node) {
    nodes.push(node);
    for (const child of node.childNodes ?? []) visit(child);
  }
  visit(document);
  const attrs = (node) => Object.fromEntries((node.attrs ?? []).map(({ name, value }) => [name, value]));
  const text = (node) => (node.childNodes ?? []).map((child) => child.value ?? '').join('').trim();
  const matching = (tag, key, value) => nodes.filter((node) => node.tagName === tag && attrs(node)[key] === value);
  const meta = (key, value) => {
    const matches = matching('meta', key, value);
    assert.equal(matches.length, 1, `Expected one ${value} on ${file}`);
    return attrs(matches[0]).content;
  };

  test(`search and sharing metadata: ${file}`, async () => {
    const title = text(nodes.find((node) => node.tagName === 'title'));
    const description = meta('name', 'description');
    assert.match(title, /CarpenTech/);
    assert.match(title, /28287/);
    assert.ok(!titles.has(title), 'Each page needs its own title');
    assert.ok(!descriptions.has(description), 'Each page needs its own description');
    titles.add(title);
    descriptions.add(description);
    assert.equal(description, description.trim());
    assert.ok(description.length > 70, 'The description should explain the page');
    const canonicals = matching('link', 'rel', 'canonical');
    assert.equal(canonicals.length, 1);
    assert.equal(attrs(canonicals[0]).href, origin + path);
    assert.equal(meta('property', 'og:url'), origin + path);
    assert.equal(meta('property', 'og:site_name'), 'CarpenTech');
    assert.equal(meta('property', 'og:title'), title);
    assert.equal(meta('property', 'og:description'), description);
    assert.equal(meta('name', 'twitter:title'), title);
    assert.equal(meta('name', 'twitter:description'), description);
    assert.equal(meta('name', 'twitter:card'), 'summary_large_image');
    assert.equal(meta('property', 'og:locale'), 'en_US');
    assert.match(meta('name', 'robots'), /max-image-preview:large/);
    assert.doesNotMatch(meta('name', 'robots'), /noindex|nofollow/);
    const image = new URL(meta('property', 'og:image'));
    assert.equal(image.origin, origin);
    assert.equal(meta('name', 'twitter:image'), image.href);
    assert.ok((await stat(new URL(`.${image.pathname}`, root))).isFile());
    assert.ok(Number(meta('property', 'og:image:width')) > 0);
    assert.ok(Number(meta('property', 'og:image:height')) > 0);
    assert.ok(meta('property', 'og:image:alt'));
    assert.equal(meta('name', 'twitter:image:alt'), meta('property', 'og:image:alt'));
    assert.equal(matching('link', 'hreflang', 'ro').length, 0, 'Do not advertise nonexistent Romanian routes');
  });

  test(`structured data: ${file}`, () => {
    const blocks = matching('script', 'type', 'application/ld+json');
    assert.equal(blocks.length, 1);
    const data = JSON.parse(text(blocks[0]));
    assert.equal(data['@context'], 'https://schema.org');
    const page = data['@graph'].find((entity) => entity['@type'] === type);
    assert.equal(page.url, origin + path);
    assert.equal(page.name, text(nodes.find((node) => node.tagName === 'title')));
    assert.equal(page.description, meta('name', 'description'));
    assert.equal(page.isPartOf['@id'], `${origin}/#website`);
    assert.equal(page.about['@id'], `${origin}/#organization`);
    assert.equal(page.inLanguage, 'en');
    if (path === '/') {
      const organization = data['@graph'].find((entity) => entity['@type'] === 'Organization');
      assert.equal(organization.name, 'CarpenTech');
      assert.equal(organization.identifier.value, '28287');
      assert.equal(organization.location.address.addressLocality, 'Cărpineni');
      assert.equal(organization.location.address.addressCountry, 'MD');
      const links = nodes.filter((node) => node.tagName === 'a').map((node) => attrs(node).href);
      for (const profile of organization.sameAs) assert.ok(links.includes(profile), 'Profiles must come from existing content');
      assert.ok(data['@graph'].some((entity) => entity['@type'] === 'WebSite' && entity.name === 'CarpenTech'));
    }
  });
}

test('sitemap lists every canonical page and robots.txt advertises it', async () => {
  const xml = await readFile(new URL('sitemap.xml', root), 'utf8');
  assert.equal(XMLValidator.validate(xml), true);
  const data = new XMLParser({ ignoreAttributes: false }).parse(xml);
  assert.equal(data.urlset['@_xmlns'], 'http://www.sitemaps.org/schemas/sitemap/0.9');
  assert.deepEqual(data.urlset.url.map(({ loc }) => loc).sort(), pages.map(({ path }) => origin + path).sort());
  const robots = await readFile(new URL('robots.txt', root), 'utf8');
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`));
  assert.doesNotMatch(robots, /^Disallow:\s*\/\s*$/m);
});
