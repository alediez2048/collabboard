import { test, expect, type Page } from '@playwright/test';

const TEST_PASSWORD = 'TestPassword123!';

const makeUniqueEmail = (suffix: string): string =>
  `board-test-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@collabboard.dev`;

async function signUpAndLandOnBoards(page: Page, suffix: string): Promise<string> {
  const email = makeUniqueEmail(suffix);
  await page.goto('/login');
  await page.getByRole('button', { name: "Don't have an account? Sign up" }).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Sign up' }).click();
  await page.waitForURL('/', { timeout: 15000 });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your Boards');
  return email;
}

async function createBoard(page: Page): Promise<string> {
  await page.getByRole('button', { name: /create board/i }).click();
  await expect(page).toHaveURL(/\/board\/[a-f0-9-]+/, { timeout: 10000 });
  const boardId = page.url().split('/').pop();
  if (!boardId) {
    throw new Error('Unable to parse board id from URL');
  }
  return boardId;
}

test.describe('Board Management', () => {
  test('persists active dashboard section and keeps create CTA available', async ({ page }) => {
    await signUpAndLandOnBoards(page, 'dashboard-section');

    const recentNav = page.getByTestId('dashboard-nav-recent');
    await recentNav.click();
    await expect(page).toHaveURL(/\/\?section=recent/);
    await expect(recentNav).toHaveAttribute('aria-current', 'page');

    await page.reload();
    await expect(page).toHaveURL(/\/\?section=recent/);
    await expect(page.getByTestId('dashboard-nav-recent')).toHaveAttribute('aria-current', 'page');

    const createButton = page.getByTestId('dashboard-create-board-button');
    await expect(createButton).toBeVisible();
    await createButton.click();
    await expect(page).toHaveURL(/\/board\/[a-f0-9-]+/, { timeout: 10000 });
  });

  test('renames a board from the board list and persists after refresh', async ({ page }) => {
    await signUpAndLandOnBoards(page, 'rename');
    const boardId = await createBoard(page);
    await page.goto('/');

    await page.getByTestId(`board-name-display-${boardId}`).click();
    const input = page.getByTestId(`board-name-input-${boardId}`);
    await expect(input).toBeVisible();
    await input.fill('Product Planning Board');
    await page.getByRole('button', { name: 'Save board name' }).click();

    await expect(page.getByTestId(`board-name-display-${boardId}`)).toContainText('Product Planning Board');
    await page.reload();
    await expect(page.getByTestId(`board-name-display-${boardId}`)).toContainText('Product Planning Board');
  });

  test('blocks invalid inline board rename for whitespace-only value', async ({ page }) => {
    await signUpAndLandOnBoards(page, 'rename-invalid');
    const boardId = await createBoard(page);
    await page.goto('/');

    await page.getByTestId(`board-name-display-${boardId}`).click();
    const input = page.getByTestId(`board-name-input-${boardId}`);
    await input.fill('   ');
    await page.getByRole('button', { name: 'Save board name' }).click();

    await expect(page.getByText('Board name cannot be empty.')).toBeVisible();
  });

  test('deletes a board only after explicit confirmation', async ({ page }) => {
    await signUpAndLandOnBoards(page, 'delete');
    const boardId = await createBoard(page);
    await page.goto('/');

    await page.getByTestId(`delete-board-${boardId}`).click();
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();
    await expect(page.getByText('This cannot be undone')).toBeVisible();

    await page.getByTestId('cancel-delete-board').click();
    await expect(page.getByTestId('confirm-dialog')).not.toBeVisible();
    await expect(page.getByTestId(`board-card-${boardId}`)).toBeVisible();

    await page.getByTestId(`delete-board-${boardId}`).click();
    await page.getByTestId('confirm-delete-board').click();
    await expect(page.getByTestId(`board-card-${boardId}`)).not.toBeVisible();
  });

  test('shows board name in board header and supports back navigation', async ({ page }) => {
    await signUpAndLandOnBoards(page, 'header');
    await createBoard(page);

    await expect(page.getByTestId('board-header-name')).toContainText('Untitled Board');
    await page.getByTestId('back-to-boards-button').click();

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Your Boards');
  });

  test('copies share link from board view', async ({ page }) => {
    await signUpAndLandOnBoards(page, 'share');
    const boardId = await createBoard(page);

    await page.evaluate(() => {
      (window as unknown as { __copiedText?: string }).__copiedText = '';
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            (window as unknown as { __copiedText?: string }).__copiedText = text;
          },
        },
      });
    });

    await page.getByTestId('share-board-button').click();
    await expect(page.getByText('Link copied!')).toBeVisible();

    const copiedText = await page.evaluate(
      () => (window as unknown as { __copiedText?: string }).__copiedText ?? '',
    );
    expect(copiedText).toContain(`/board/${boardId}`);
  });
});
