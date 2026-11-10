import { expect, test, type Page } from '@playwright/test';

/** Anything the page throws or logs as an error fails the test that caused it. */
function watchForErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

const next = (page: Page) => page.getByRole('button', { name: /^Next:/ }).click();
const goTo = (page: Page, step: string) =>
  page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name: step }).click();
const pattern = (page: Page, name: string) =>
  page.locator('label.pattern', { has: page.locator('.title', { hasText: new RegExp(`^${name}$`) }) });
const section = (page: Page, title: string) =>
  page.locator('.plan section', { has: page.locator('h3', { hasText: title }) });

const PATTERNS = ['Checkerboard', 'Brick', 'Stripes', 'Chaotic', 'Basket weave', 'Chevron', '3D illusion'];

test('a first-time visitor gets from the first screen to a cut list', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tell us about your shop' })).toBeVisible();

  await next(page);
  await expect(page.getByRole('heading', { name: 'Choose your wood' })).toBeVisible();
  await expect(page.getByRole('img', { name: /^Preview of the board/ })).toBeVisible();

  await next(page);
  await expect(page.getByRole('heading', { name: 'Pick a pattern' })).toBeVisible();
  await expect(page.locator('label.pattern')).toHaveCount(PATTERNS.length);

  await next(page);
  await expect(page.getByRole('heading', { name: 'Set the size' })).toBeVisible();
  await expect(page.locator('.preview .size')).toHaveText('15" × 13" × 1-1/2" thick');

  await next(page);
  await expect(page.getByRole('heading', { name: 'Your cut list' })).toBeVisible();
  await expect(page.locator('.plan .lead')).toContainText('checkerboard board in Hard maple and Black walnut');
  await expect(section(page, 'Buy your wood')).toContainText('12 boards in total');
  await expect(section(page, 'Cut the strips')).toContainText('Every strip is 14-3/8" long');
  await expect(section(page, 'Slice the panel')).toContainText('8 slices');
  await expect(page.locator('.notices')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Print cut list' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('full instructions add pictures, steps and sourced tips', async ({ page }) => {
  await page.goto('/');
  await goTo(page, 'Cut list');
  await expect(page.locator('.plan section h3 .number')).toHaveCount(6);

  await page.getByRole('radio', { name: /Full instructions/ }).check();
  await expect(page.getByRole('heading', { name: 'Your build instructions' })).toBeVisible();
  await expect(page.locator('.plan section h3 .number')).toHaveCount(9);
  await expect(page.locator('.step-diagram').first()).toBeVisible();
  await expect(page.locator('.tip').first()).toBeVisible();
  // Every tip links to where it came from.
  const tips = await page.locator('.tip').count();
  expect(tips).toBeGreaterThan(10);
  await expect(page.locator('.tip:not(:has(a[href^="https://"]))')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Print instructions' })).toBeVisible();
});

for (const name of PATTERNS) {
  test(`the ${name} pattern produces a cut list and instructions with nothing to fix`, async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    await goTo(page, 'Pattern');
    await pattern(page, name).click();
    await expect(pattern(page, name)).toHaveClass(/selected/);
    await expect(page.getByRole('img', { name: /^Preview of the board/ })).toBeVisible();

    await goTo(page, 'Cut list');
    await expect(page.getByRole('heading', { name: 'Your cut list' })).toBeVisible();
    await expect(page.locator('.notices .problem')).toHaveCount(0);
    await expect(page.getByRole('img', { name: 'The finished board' })).toBeVisible();
    await expect(section(page, 'Cut the strips').locator('tbody tr').first()).toBeVisible();

    await page.getByRole('radio', { name: /Full instructions/ }).check();
    await expect(page.locator('.step-diagram')).not.toHaveCount(0);
    await expect(page.locator('.substeps li').first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('the 3D illusion board explains its two panels and the re-ripping', async ({ page }) => {
  await page.goto('/');
  await goTo(page, 'Pattern');
  await expect(pattern(page, '3D illusion').locator('.level')).toHaveText('Advanced');
  await pattern(page, '3D illusion').click();

  await next(page);
  // The board is always square, so only one size is asked for.
  await expect(page.getByLabel('Length of each side')).toHaveValue('12-15/32"');
  await expect(page.getByLabel('Width', { exact: true })).toHaveCount(0);
  await expect(page.locator('.preview .size')).toHaveText('12-1/2" × 12-1/2" × 1-1/2" thick');

  await next(page);
  await expect(page.getByRole('img', { name: /^The glued panel/ })).toHaveCount(2);
  const strips = section(page, 'Cut the strips');
  await expect(strips).toContainText('strips for panel A are 9-1/8" long and strips for panel B are 7-3/8" long');
  const panels = section(page, 'Glue the strips into panels');
  await expect(panels.getByRole('heading', { name: 'Panel A' })).toBeVisible();
  await expect(panels.getByRole('heading', { name: 'Panel B' })).toBeVisible();
  await expect(panels.locator('.strip-order')).toHaveCount(2);
  await expect(panels.locator('.strip-order').first().locator('li')).toHaveCount(21);
  await expect(panels).toContainText('The widths are the same as panel A, with the two woods swapped.');
  await expect(section(page, 'Slice the panels')).toContainText('panel A into 5 slices and panel B into 4 slices');
  const rerip = section(page, 'Rip the slices into pieces');
  await expect(rerip).toContainText('21 pieces');
  await expect(rerip.locator('tbody tr').first()).toContainText('Panel A');
  await expect(section(page, 'Arrange and glue the pieces').locator('.strip-order li')).toHaveCount(21);
});

test('the design is remembered between visits, and Start over clears it', async ({ page }) => {
  await page.goto('/');
  await goTo(page, 'Pattern');
  await pattern(page, 'Brick').click();
  await page.reload();
  await goTo(page, 'Pattern');
  await expect(pattern(page, 'Brick')).toHaveClass(/selected/);

  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Start over' }).click();
  await goTo(page, 'Pattern');
  await expect(pattern(page, 'Checkerboard')).toHaveClass(/selected/);
});

test('with too little of your own wood, the cut list says what is missing', async ({ page }) => {
  await page.goto('/');
  await goTo(page, 'Your wood');
  await page.getByRole('radio', { name: /I already have boards/ }).check();
  await expect(page.getByText('No boards yet')).toBeVisible();

  // One maple board is not enough for a checkerboard, which needs two woods.
  await page.getByRole('button', { name: 'Add board' }).click();
  await expect(page.locator('table.stock tbody tr')).toHaveCount(1);
  await goTo(page, 'Cut list');
  await expect(page.locator('.plan, .step')).toContainText('needs at least 2 woods');

  await goTo(page, 'Your wood');
  await page.getByLabel('Wood', { exact: true }).selectOption({ label: 'Black walnut' });
  await page.getByRole('button', { name: 'Add board' }).click();
  await expect(page.locator('table.stock tbody tr')).toHaveCount(2);
  await goTo(page, 'Cut list');
  await expect(page.locator('.notices .problem').first()).toContainText('Not enough');

  // Six of each is plenty.
  await goTo(page, 'Your wood');
  for (const wood of ['Hard maple', 'Black walnut']) {
    await page.getByLabel(`How many ${wood} boards`).fill('6');
  }
  await goTo(page, 'Cut list');
  await expect(page.locator('.notices .problem')).toHaveCount(0);
  await expect(section(page, 'Gather your boards')).toBeVisible();
});

test('switching to millimetres changes every size on the cut list', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('radio', { name: /Millimetres/ }).check();
  await goTo(page, 'Cut list');
  await expect(page.locator('.plan .lead')).toContainText('381 mm × 330.2 mm × 38.1 mm thick');
  await expect(page.locator('.plan')).not.toContainText('"');
});
