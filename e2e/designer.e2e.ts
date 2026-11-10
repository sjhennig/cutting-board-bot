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
const section = (page: Page, title: string | RegExp) =>
  page.locator('.plan section', { has: page.locator('h3', { hasText: title }) });

/** Open the designer and ask it to suggest what to buy, as someone with no wood yet would. */
async function startBuying(page: Page): Promise<void> {
  await page.goto('/');
  await goTo(page, 'Your wood');
  await page.getByRole('radio', { name: /Suggest what to buy/ }).check();
}

const PATTERNS = [
  'Checkerboard',
  'Brick',
  'Stripes',
  'Chaotic',
  'Basket weave',
  'Chevron',
  'Plaid',
  'Framed',
  'Tumbling blocks',
  '3D illusion',
];

test('a first-time visitor designs a board around their own boards, at the sizes they measure', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tell us about your shop' })).toBeVisible();

  await next(page);
  await expect(page.getByRole('heading', { name: 'Your wood' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /I have boards/ })).toBeChecked();
  await expect(page.getByText('No boards yet')).toBeVisible();
  await expect(page.locator('.preview')).toContainText('Add the boards you have');

  // Sizes no catalog sells: whatever the tape measure says.
  for (const wood of ['Hard maple', 'Black walnut']) {
    await page.getByLabel('Wood', { exact: true }).selectOption({ label: wood });
    for (const [label, size] of [
      ['Thickness', '1-7/16'],
      ['Width', '6-13/16'],
      ['Length', '31-1/2'],
    ] as const) {
      await page.getByLabel(label, { exact: true }).fill(size);
      await page.getByLabel(label, { exact: true }).press('Enter');
    }
    await page.getByRole('button', { name: 'Add board' }).click();
  }
  await expect(page.locator('table.stock tbody tr')).toHaveCount(2);
  await expect(page.locator('table.stock tbody tr').first()).toContainText('1-7/16"');
  await expect(page.locator('table.stock tbody tr').first()).toContainText('6-13/16"');
  // The design already suits these boards: nothing to fix, and a board they can really make.
  await expect(page.locator('.preview .notices .problem')).toHaveCount(0);
  await expect(page.getByRole('img', { name: /^Preview of the board/ })).toBeVisible();

  await next(page);
  await expect(page.locator('label.pattern')).toHaveCount(PATTERNS.length);

  await next(page);
  await expect(page.getByRole('heading', { name: 'Set the size' })).toBeVisible();
  // The strips are already as thick as the boards that were entered.
  await expect(page.getByLabel('Strip thickness')).toHaveValue('1-7/16"');
  await expect(page.locator('.step')).toContainText('This size was chosen to suit your boards');
  await expect(page.locator('.preview .notices .problem')).toHaveCount(0);

  await next(page);
  await expect(page.getByRole('heading', { name: 'Your cut list' })).toBeVisible();
  await expect(page.locator('.plan .lead')).toContainText('checkerboard board in Hard maple and Black walnut');
  await expect(section(page, 'Gather your boards')).toContainText('2 boards in total');
  await expect(page.locator('.notices .problem')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Print cut list' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('someone with no wood yet gets a shopping list, then swaps in the sizes that arrive', async ({ page }) => {
  const errors = watchForErrors(page);
  await startBuying(page);
  await expect(page.getByRole('img', { name: /^Preview of the board/ })).toBeVisible();
  await expect(page.locator('.step')).toContainText('as a reference');

  await goTo(page, 'Size');
  await expect(page.locator('.preview .size')).toHaveText('15" × 13" × 1-1/2" thick');

  await next(page);
  await expect(section(page, 'Buy your wood')).toContainText('12 boards in total');
  await expect(section(page, 'Cut the strips')).toContainText('Every strip is 14-3/8" long');
  await expect(section(page, 'Slice the panel')).toContainText('8 slices');
  await expect(page.locator('.notices')).toHaveCount(0);

  // The shopping list becomes the user's own boards, ready to be corrected.
  await page.getByRole('button', { name: 'My boards are a different size' }).click();
  await expect(section(page, 'Gather your boards')).toBeVisible();
  await goTo(page, 'Your wood');
  await expect(page.getByRole('radio', { name: /I have boards/ })).toBeChecked();
  await expect(page.locator('table.stock tbody tr')).toHaveCount(2);
  await expect(page.getByLabel('How many Hard maple boards')).toHaveValue('6');
  expect(errors).toEqual([]);
});

test('full instructions add pictures, steps and sourced tips', async ({ page }) => {
  await startBuying(page);
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
    await startBuying(page);
    if (name === 'Tumbling blocks') {
      // The one pattern that needs a third wood.
      await goTo(page, 'Pattern');
      await expect(pattern(page, name)).toContainText('Needs 3 woods');
      await goTo(page, 'Your wood');
      await page.locator('label.species', { hasText: 'Cherry' }).click();
    }
    await goTo(page, 'Pattern');
    await pattern(page, name).click();
    await expect(pattern(page, name)).toHaveClass(/selected/);
    await expect(page.getByRole('img', { name: /^Preview of the board/ })).toBeVisible();

    await goTo(page, 'Cut list');
    await expect(page.getByRole('heading', { name: 'Your cut list' })).toBeVisible();
    await expect(page.locator('.notices .problem')).toHaveCount(0);
    await expect(page.getByRole('img', { name: 'The finished board' })).toBeVisible();
    await expect(
      section(page, /^\d+Cut the (strips|diamond sticks)$/)
        .locator('tbody tr')
        .first(),
    ).toBeVisible();

    await page.getByRole('radio', { name: /Full instructions/ }).check();
    await expect(page.locator('.step-diagram')).not.toHaveCount(0);
    await expect(page.locator('.substeps li').first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('the 3D illusion board explains its two panels and the re-ripping', async ({ page }) => {
  await startBuying(page);
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
  await expect(panels).toContainText('The widths are the same as panel A; only the woods differ.');
  await expect(section(page, 'Slice the panels')).toContainText('panel A into 5 slices and panel B into 4 slices');
  const rerip = section(page, 'Rip the slices into pieces');
  await expect(rerip).toContainText('21 pieces');
  await expect(rerip.locator('tbody tr').first()).toContainText('Panel A');
  await expect(section(page, 'Arrange and glue the pieces').locator('.strip-order li')).toHaveCount(21);
});

test('the design is remembered between visits, and Start over clears it', async ({ page }) => {
  await startBuying(page);
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

test('the board is sized to your own wood, and asking for more says what is missing', async ({ page }) => {
  await page.goto('/');
  await goTo(page, 'Your wood');
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
  // Two boards cannot make the usual size, so the designer starts with a smaller board that they can.
  await goTo(page, 'Cut list');
  await expect(page.locator('.notices .problem')).toHaveCount(0);

  // Asking for more than the wood allows says exactly what is missing.
  await goTo(page, 'Size');
  await page.getByLabel('Length', { exact: true }).fill('30');
  await page.getByLabel('Length', { exact: true }).press('Enter');
  await expect(page.locator('.preview .notices .problem').first()).toContainText('Not enough');
  await goTo(page, 'Cut list');
  await expect(page.locator('.notices .problem').first()).toContainText('Not enough');

  // The designer can shrink the board to fit the wood there is.
  await goTo(page, 'Size');
  await page.getByRole('button', { name: 'Make the biggest board my wood allows' }).click();
  await expect(page.locator('.preview .notices .problem')).toHaveCount(0);
  await goTo(page, 'Cut list');
  await expect(page.locator('.notices .problem')).toHaveCount(0);
  await expect(section(page, 'Gather your boards')).toBeVisible();

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
  await startBuying(page);
  await goTo(page, 'Your shop');
  await page.getByRole('radio', { name: /Millimetres/ }).check();
  await goTo(page, 'Cut list');
  await expect(page.locator('.plan .lead')).toContainText('381 mm × 330.2 mm × 38.1 mm thick');
  await expect(page.locator('.plan')).not.toContainText('"');
});

test('a copied link opens the same design in a browser that has never seen it', async ({ page, browser }) => {
  await startBuying(page);
  await goTo(page, 'Pattern');
  await pattern(page, 'Chevron').click();
  await goTo(page, 'Cut list');
  await page.getByRole('button', { name: 'Copy a link to this design' }).click();
  const link = await page.getByLabel(/Anyone who opens it sees this design/).inputValue();
  expect(link).toContain('#d=');

  const other = await browser.newContext();
  const visitor = await other.newPage();
  const errors = watchForErrors(visitor);
  await visitor.goto(link);
  // The visitor lands on the cut list, with the address tidied.
  await expect(visitor.locator('.plan .lead')).toContainText('chevron board in Hard maple and Black walnut');
  await expect(visitor).toHaveURL(/^[^#]*$/);
  // It is now their design: it survives a reload without the link.
  await visitor.reload();
  await goTo(visitor, 'Pattern');
  await expect(pattern(visitor, 'Chevron')).toHaveClass(/selected/);
  expect(errors).toEqual([]);
  await other.close();
});

test('a damaged link falls back to a working designer', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.goto('/#d=eyJwYXR0ZXJuIjoibm9wZSIsInN0b2NrIjpbe31dfQ'); // {"pattern":"nope","stock":[{}]}
  // The bad pattern and the board that is not a board are dropped; the wood mode of an old link is kept.
  await expect(page.locator('.plan .lead')).toContainText('checkerboard board');
  await page.goto('/#d=!!!');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tell us about your shop' })).toBeVisible();
  expect(errors).toEqual([]);
});
