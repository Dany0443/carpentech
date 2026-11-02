import { test, expect } from '@playwright/test';

async function captureMidpoint(locator, filename) {
  await locator.evaluate((element) => {
    for (const animation of element.getAnimations({ subtree: true })) {
      const timing = animation.effect.getTiming();
      animation.pause();
      animation.currentTime = timing.delay + Number(timing.duration) / 2;
    }
  });
  await locator.screenshot({
    path: test.info().outputPath(filename),
    scale: 'css',
    style: '.site-header, .skip-link { visibility: hidden; }',
  });
  await locator.evaluate((element) => {
    element.getAnimations({ subtree: true }).forEach((animation) => animation.finish());
  });
}

test('each disclosure expands its document space and fully releases its measured height', async ({
  page,
}) => {
  await page.goto('/');

  for (const details of await page.locator('details').all()) {
    const summary = details.locator('summary');
    const collapsedHeight = await details.evaluate((element) => element.offsetHeight);
    await summary.click();
    const expansion = await details.evaluate(
      (element) =>
        element
          .getAnimations()
          .find((animation) => animation.effect.getKeyframes().some((frame) => 'height' in frame))
          ?.effect.getTiming().duration,
    );
    expect(expansion).toBe(240);
    if ((await details.getAttribute('class')) === 'build-notes') {
      await captureMidpoint(details, 'disclosure-midpoint.png');
    }
    await expect.poll(() => details.evaluate((element) => element.style.height)).toBe('');
    expect(await details.evaluate((element) => element.offsetHeight)).toBeGreaterThan(
      collapsedHeight,
    );

    await summary.click();
    await expect(details).toHaveJSProperty('open', false);
    expect(
      await details.evaluate((element) => [element.style.height, element.style.overflow]),
    ).toEqual(['', '']);
  }
});

test('disclosures follow the latest click and keyboard activation settles immediately', async ({
  page,
}) => {
  await page.goto('/');
  const details = page.locator('.build-notes');
  const summary = details.locator('summary');
  await summary.scrollIntoViewIfNeeded();
  for (let click = 0; click < 5; click++) await summary.click({ force: true });
  await expect(details).toHaveJSProperty('open', true);
  await expect.poll(() => details.evaluate((element) => element.style.height)).toBe('');

  await summary.click({ force: true });
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(details).toHaveJSProperty('open', true);
  expect(await details.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(
    0,
  );
  await page.keyboard.press('Space');
  await expect(details).toHaveJSProperty('open', false);
});

test('a reduced-motion change settles an expanding disclosure and removes spatial effects', async ({
  page,
}) => {
  await page.goto('/');
  const details = page.locator('.build-notes');
  await details.locator('summary').click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(details).toHaveJSProperty('open', true);
  await expect.poll(() => details.evaluate((element) => element.style.height)).toBe('');
  expect(
    await details
      .locator('.details-body')
      .evaluate((element) => getComputedStyle(element).transform),
  ).toBe('none');
  await details.locator('summary').click();
  await expect(details).toHaveJSProperty('open', false);
});

test('first-scroll headlines and photos have distinct entrances and never replay on scroll-back', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.revealEvents = [];
    document.addEventListener('animationstart', (event) => {
      if (event.target.matches('[data-reveal]')) {
        window.revealEvents.push({ id: event.target.id, name: event.animationName });
      }
    });
  });
  await page.goto('/');
  await page.locator('#story-title').scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.revealEvents
          .filter((event) => event.id === 'story-title')
          .map((event) => event.name),
      ),
    )
    .toEqual(['headline-in']);
  await captureMidpoint(page.locator('.story-intro'), 'headline-midpoint.png');
  await page.locator('.process-photos').scrollIntoViewIfNeeded();
  await expect
    .poll(() => page.evaluate(() => window.revealEvents.some((event) => event.name === 'photo-in')))
    .toBe(true);
  await expect.poll(() => page.locator('.animate-in').count()).toBe(0);
  await page.locator('#hero-title').scrollIntoViewIfNeeded();
  await page.locator('#story-title').scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => window.revealEvents.filter((event) => event.id === 'story-title').length,
    ),
  ).toBe(1);
});
