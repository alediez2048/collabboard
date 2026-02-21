import { test, expect, type Page } from '@playwright/test';

const TEST_PASSWORD = 'TestPassword123!';

const makeUniqueEmail = (suffix: string): string =>
  `text-tool-test-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@collabboard.dev`;

async function signUpAndLandOnBoards(page: Page, suffix: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const email = makeUniqueEmail(`${suffix}-attempt-${attempt + 1}`);
    await page.goto('/login');
    await page.getByRole('button', { name: "Don't have an account? Sign up" }).click();
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign up' }).click();

    const reachedBoardsAfterSignUp = await page
      .waitForURL('/', { timeout: 15000 })
      .then(() => true)
      .catch(() => false);

    if (reachedBoardsAfterSignUp) {
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Your Boards');
      return;
    }

    const signInToggle = page.getByRole('button', { name: 'Already have an account? Sign in' });
    if (await signInToggle.count()) {
      await signInToggle.click();
      await page.getByLabel('Email address').fill(email);
      await page.getByLabel('Password').fill(TEST_PASSWORD);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await page.waitForURL('/', { timeout: 10000 });
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Your Boards');
      return;
    }
  }

  throw new Error('Unable to sign up and reach boards after retries');
}

async function createBoard(page: Page): Promise<void> {
  await page.getByRole('button', { name: /create board/i }).click();
  await expect(page).toHaveURL(/\/board\/[a-f0-9-]+/, { timeout: 10000 });
}

async function readObjectCapacityCount(page: Page): Promise<number> {
  const row = page.getByText('Object capacity', { exact: true }).locator('xpath=..');
  const valueText = (await row.locator('span').nth(1).textContent())?.trim() ?? '';
  const match = valueText.match(/^(\d+)\s*\/\s*\d+\+$/);

  if (!match) {
    throw new Error(`Unable to parse object capacity value: "${valueText}"`);
  }

  return Number.parseInt(match[1], 10);
}

test.describe('Text Tool', () => {
  test.describe.configure({ mode: 'serial' });

  test('creates a text object when clicking canvas with text tool selected', async ({ page }) => {
    await signUpAndLandOnBoards(page, 'create');
    await createBoard(page);

    await expect(page.getByRole('heading', { name: 'Performance Indicators' })).toBeVisible();
    const initialCount = await readObjectCapacityCount(page);

    await page.locator('button[title="Text"]').click();
    await page.mouse.click(680, 360);

    await expect.poll(async () => readObjectCapacityCount(page)).toBe(initialCount + 1);
    await expect(page.locator('.text-editor-overlay')).toBeVisible();
  });
});
