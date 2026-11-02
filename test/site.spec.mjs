import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const names = [
  'Eugen Covas',
  'Maxim Rusu',
  'Daniel Arnautu',
  'Arian Buhna',
  'Eduard Cojocaru',
  'Alexandru Rusu',
  'Daniel Iaconi',
  'Victor Recichin',
  'Tudor Bostan',
];

test('every member has a personal card and all of their roles can be filtered', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.member-card:visible h3')).toHaveText(names);

  for (const [filter, members] of [
    ['engineering', ['Eugen Covas', 'Maxim Rusu', 'Eduard Cojocaru']],
    ['design', ['Maxim Rusu', 'Arian Buhna', 'Eduard Cojocaru']],
    ['code', ['Daniel Arnautu', 'Alexandru Rusu']],
    ['people', ['Alexandru Rusu', 'Daniel Iaconi', 'Victor Recichin', 'Tudor Bostan']],
    ['all', names],
  ]) {
    const button = page.locator(`[data-team-filter="${filter}"]`);
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.member-card:visible h3')).toHaveText(members);
    await expect(page.locator('#team-status')).toContainText(String(members.length));
  }

  const filter = page.locator('[data-team-filter="all"]');
  await filter.focus();
  await page.keyboard.press('End');
  await expect(page.locator('[data-team-filter="people"]')).toBeFocused();
});

test('email links and copy use the assembled address with the chosen intent', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  const address = ['carpentech', ['carpineni', 'ro'].join('.')].join('@');
  await expect(page.locator('[data-email-address]')).toHaveText(address);

  for (const [intent, subject] of [
    ['partner', 'Partnership with CarpenTech'],
    ['mentor', 'Mentoring CarpenTech'],
    ['join', 'Joining CarpenTech'],
  ]) {
    await page.locator(`[data-intent="${intent}"]`).click();
    const href = await page.locator('#intent-email').getAttribute('href');
    const url = new URL(href);
    expect(url.pathname).toBe(address);
    expect(url.searchParams.get('subject')).toBe(subject);
    expect(href).not.toContain('+');
  }

  await page.locator('#copy-email').click();
  await expect(page.locator('#snackbar')).toContainText('Email copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(address);
});

test('a blocked clipboard selects the assembled email for manual copying', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async () => {
          throw new Error('Clipboard denied');
        },
      },
    });
  });
  await page.goto('/');
  await page.locator('#copy-email').click();
  await expect(page.locator('#snackbar')).toContainText('Email selected');
  expect(await page.evaluate(() => getSelection().toString())).toBe(
    ['carpentech', ['carpineni', 'ro'].join('.')].join('@'),
  );
});

test('reduced motion follows system changes and settles every interaction', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('[data-motion-toggle]')).toHaveCount(0);
  await page.locator('[data-system="drive"]').click();
  await expect(page.locator('[data-robot-detail="drive"]')).toBeVisible();
  await page.locator('[data-team-filter="code"]').click();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('[data-system="control"]').click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('[data-robot-detail="control"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test('dialogs restore focus and rapid robot selections keep the latest state', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.locator('#photo-open').click();
  await expect(page.locator('#photo-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#photo-dialog')).not.toBeVisible();
  await expect(page.locator('#photo-open')).toBeFocused();

  for (const system of ['drive', 'control', 'overview', 'drive', 'control']) {
    await page.locator(`[data-system="${system}"]`).click();
  }
  await expect(page.locator('[data-robot-detail]:visible')).toHaveAttribute(
    'data-robot-detail',
    'control',
  );
  await expect(page.locator('#explorer-image')).toHaveAttribute('alt', /control hubs/);
  expect(errors).toEqual([]);
});

test('narrow, medium, and wide layouts do not overflow in either theme', async ({ page }) => {
  await page.goto('/');
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (let theme = 0; theme < 2; theme++) {
      await page.locator('#theme-toggle').click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
  }
});

test('the page and team cards pass an automated accessibility scan in both themes', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.screenshot({
    path: test.info().outputPath('page-initial.png'),
    scale: 'css',
    animations: 'disabled',
  });
  for (let theme = 0; theme < 2; theme++) {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
    await page.locator('#team').screenshot({
      path: test.info().outputPath(`team-theme-${theme}.png`),
      scale: 'css',
      style: '.site-header { visibility: hidden; }',
      animations: 'disabled',
    });
    await page.locator('#theme-toggle').click();
  }
});

test('mobile navigation closes with Escape, restores focus, and follows its links', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const trigger = page.locator('#menu-open');
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#mobile-menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await page
    .getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('link', { name: 'The team' })
    .click();
  await expect(page).toHaveURL(/#team$/);
  await expect(page.locator('#mobile-menu')).not.toBeVisible();
  const scrollPadding = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop),
  );
  await expect
    .poll(async () => {
      const heading = await page.locator('#team-title').boundingBox();
      const header = await page.locator('.site-header').boundingBox();
      return (
        Math.abs(heading.y - scrollPadding) < 2 &&
        heading.y >= header.y + header.height &&
        heading.y + heading.height < page.viewportSize().height
      );
    })
    .toBe(true);
  await page.screenshot({
    path: test.info().outputPath('team-navigation.png'),
    scale: 'css',
    animations: 'disabled',
  });
});

test('team labels remain readable with doubled text size', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const fits = await page
      .locator('.member-card')
      .evaluateAll((cards) =>
        cards.every(
          (card) => card.scrollWidth <= card.clientWidth && card.scrollHeight <= card.clientHeight,
        ),
      );
    expect(fits).toBe(true);
  }
});

test('SVG assets are well-formed XML and website resources load successfully', async ({ page }) => {
  const failures = [];
  page.on('response', (response) => {
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('/');
  for (const asset of ['carpentech-logo.svg', 'favicon.svg']) {
    const response = await page.request.get(`/public/${asset}`);
    expect(response.ok()).toBe(true);
    const source = await response.text();
    const error = await page.evaluate(
      (svg) =>
        new DOMParser().parseFromString(svg, 'image/svg+xml').querySelector('parsererror')
          ?.textContent,
      source,
    );
    expect(error).toBeUndefined();
  }
  expect(failures).toEqual([]);
});

test('team and contact remain understandable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.locator('.member-card:visible h3')).toHaveText(names);
  await expect(page.locator('.primary-nav')).toBeVisible();
  await expect(page.locator('.email-block')).toContainText('carpentech [at] carpineni [dot] ro');
  await context.close();
});
