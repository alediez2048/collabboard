import { test, expect, type Page } from '@playwright/test';

const TEST_PASSWORD = 'TestPassword123!';
const SELECT_ALL_SHORTCUT = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';

const makeUniqueEmail = (suffix: string): string =>
  `board-test-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@collabboard.dev`;

async function signUpAndLandOnBoards(page: Page, suffix: string): Promise<string> {
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
      return email;
    }

    const signInToggle = page.getByRole('button', { name: 'Already have an account? Sign in' });
    if (await signInToggle.count()) {
      await signInToggle.click();
      await page.getByLabel('Email address').fill(email);
      await page.getByLabel('Password').fill(TEST_PASSWORD);
      await page.getByRole('button', { name: 'Sign in' }).click();

      const reachedBoardsAfterSignIn = await page
        .waitForURL('/', { timeout: 10000 })
        .then(() => true)
        .catch(() => false);

      if (reachedBoardsAfterSignIn) {
        await expect(page.getByRole('heading', { level: 1 })).toContainText('Your Boards');
        return email;
      }
    }
  }

  throw new Error('Unable to sign up and reach boards after retries');
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

async function readObjectCapacityCount(page: Page): Promise<number> {
  const row = page.getByText('Object capacity', { exact: true }).locator('xpath=..');
  const valueText = (await row.locator('span').nth(1).textContent())?.trim() ?? '';
  const match = valueText.match(/^(\d+)\s*\/\s*\d+\+$/);

  if (!match) {
    throw new Error(`Unable to parse object capacity value: "${valueText}"`);
  }

  return Number.parseInt(match[1], 10);
}

test.describe('Board Management', () => {
  test.describe.configure({ mode: 'serial' });

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

  test('toggles dashboard view mode and persists preference after refresh', async ({ page }) => {
    await signUpAndLandOnBoards(page, 'dashboard-view-mode');

    const listToggle = page.getByTestId('dashboard-view-list');
    const gridToggle = page.getByTestId('dashboard-view-grid');

    await expect(gridToggle).toHaveAttribute('aria-pressed', 'true');
    await listToggle.click();
    await expect(page).toHaveURL(/view=list/);
    await expect(listToggle).toHaveAttribute('aria-pressed', 'true');
    await expect(gridToggle).toHaveAttribute('aria-pressed', 'false');

    await page.reload();
    await expect(page.getByTestId('dashboard-view-list')).toHaveAttribute('aria-pressed', 'true');

    const storedMode = await page.evaluate(() => window.localStorage.getItem('collabboard.dashboard.view-mode'));
    expect(storedMode).toBe('list');
  });

  test('creates quick-start template boards from the home gallery', async ({ page }) => {
    await signUpAndLandOnBoards(page, 'template-gallery');
    const templates = [
      { id: 'kanban', boardName: 'Kanban Board' },
      { id: 'swot', boardName: 'SWOT Analysis' },
      { id: 'lean_canvas', boardName: 'Lean Canvas' },
      { id: 'retrospective', boardName: 'Retrospective' },
    ] as const;

    for (const template of templates) {
      await page.goto('/');
      const templateButton = page.getByTestId(`template-create-${template.id}`);
      await expect(templateButton).toBeVisible();
      await templateButton.click();

      await expect(page).toHaveURL(/\/board\/[a-f0-9-]+/, { timeout: 15000 });
      await expect(page.getByTestId('board-header-name')).toContainText(template.boardName);
      await expect.poll(async () => readObjectCapacityCount(page)).toBeGreaterThan(0);
      await page.reload();
      await expect(page.getByTestId('board-header-name')).toContainText(template.boardName);
      await expect.poll(async () => readObjectCapacityCount(page)).toBeGreaterThan(0);
    }
  });

  test('tracks recent ordering based on board open activity', async ({ page }) => {
    await signUpAndLandOnBoards(page, 'recent-ordering');
    const firstBoardId = await createBoard(page);
    await page.goto('/');
    const secondBoardId = await createBoard(page);

    await page.goto('/?section=recent');
    const recentCards = page.locator('[data-testid^="board-card-"]');
    await expect(recentCards.first()).toHaveAttribute('data-testid', `board-card-${secondBoardId}`);

    await page.goto('/');
    await page
      .getByTestId(`board-card-${firstBoardId}`)
      .getByRole('link', { name: 'Open board' })
      .click();
    await expect(page).toHaveURL(new RegExp(`/board/${firstBoardId}$`));

    await page.goto('/?section=recent');
    await expect(recentCards.first()).toHaveAttribute('data-testid', `board-card-${firstBoardId}`);
  });

  test('supports starring and searching within active dashboard section', async ({ page }) => {
    await signUpAndLandOnBoards(page, 'star-search');
    const boardId = await createBoard(page);
    await page.goto('/');

    await page.getByTestId(`toggle-star-${boardId}`).click();
    await page.getByTestId('dashboard-nav-starred').click();

    await expect(page).toHaveURL(/\/\?section=starred/);
    await expect(page.getByTestId(`board-card-${boardId}`)).toBeVisible();

    await page.getByLabel('Search boards').fill('missing');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText('No boards match "missing"')).toBeVisible();

    await page.getByRole('link', { name: 'Clear' }).click();
    await expect(page.getByTestId(`board-card-${boardId}`)).toBeVisible();
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

  test('deletes selected canvas objects with keyboard shortcuts', async ({ page }) => {
    await signUpAndLandOnBoards(page, 'canvas-delete');
    await createBoard(page);

    await expect(page.getByRole('heading', { name: 'Performance Indicators' })).toBeVisible();
    await page.keyboard.press(SELECT_ALL_SHORTCUT);
    await page.keyboard.press('Backspace');
    await expect.poll(async () => readObjectCapacityCount(page)).toBe(0);

    await page.locator('button[title="Sticky Note"]').click();
    await page.mouse.click(700, 360);
    await expect.poll(async () => readObjectCapacityCount(page)).toBe(1);

    await page.keyboard.press(SELECT_ALL_SHORTCUT);
    await page.keyboard.press('Backspace');
    await expect.poll(async () => readObjectCapacityCount(page)).toBe(0);

    await page.keyboard.press(SELECT_ALL_SHORTCUT);
    await page.locator('button[title="Sticky Note"]').click();
    await page.mouse.click(700, 360);
    await expect.poll(async () => readObjectCapacityCount(page)).toBe(1);

    await page.keyboard.press(SELECT_ALL_SHORTCUT);
    await page.keyboard.press('Delete');
    await expect.poll(async () => readObjectCapacityCount(page)).toBe(0);
  });

  test('clears board only after confirmation and persists cleared state', async ({ page }) => {
    await signUpAndLandOnBoards(page, 'clear-board');
    await createBoard(page);

    await page.locator('button[title="Sticky Note"]').click();
    await page.mouse.click(720, 360);
    await expect.poll(async () => readObjectCapacityCount(page)).toBe(1);

    await page.getByTestId('clear-board-button').click();
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();
    await page.getByTestId('cancel-clear-board').click();
    await expect.poll(async () => readObjectCapacityCount(page)).toBe(1);

    await page.getByTestId('clear-board-button').click();
    await page.getByTestId('confirm-clear-board').click();
    await expect.poll(async () => readObjectCapacityCount(page)).toBe(0);

    await page.reload();
    await expect.poll(async () => readObjectCapacityCount(page)).toBe(0);
  });

  test('creates and reopens a comment thread from a canvas pin', async ({ page }) => {
    await signUpAndLandOnBoards(page, 'comment-thread');
    await createBoard(page);

    await page.locator('button[title="Comment"]').click();
    await page.mouse.click(760, 340);
    await expect(page.getByTestId('comment-thread-panel')).toBeVisible();

    await page.getByPlaceholder('Write a reply...').fill('First threaded comment');
    await page.getByTestId('comment-submit-button').click();
    await expect(page.getByText('First threaded comment')).toBeVisible();

    await page.getByLabel('Close comment thread').click();
    await page.getByTitle('Open comment thread').first().click();
    await expect(page.getByText('First threaded comment')).toBeVisible();

    await page.getByRole('button', { name: 'Resolve' }).click();
    await expect(page.getByTestId('comment-thread-panel')).not.toBeVisible();
  });

  test('keeps AI color-group move targeting scoped to matching objects', async ({ page }) => {
    await signUpAndLandOnBoards(page, 'ai-color-targeting');
    await createBoard(page);

    const aiBar = page.getByTestId('ai-command-bar');
    const aiInput = aiBar.getByLabel('AI board command');
    const sendButton = aiBar.getByRole('button', { name: 'Send AI command' });
    const aiStatus = aiBar.getByRole('status');

    await aiInput.fill('Add 12 pink sticky notes');
    await sendButton.click();
    await expect(aiStatus).toContainText('12 objects updated', { timeout: 20000 });

    await aiInput.fill('Add 12 blue sticky notes');
    await sendButton.click();
    await expect(aiStatus).toContainText('12 objects updated', { timeout: 20000 });

    await aiInput.fill('Move all pink sticky notes to the right side');
    await sendButton.click();
    await expect(aiStatus).toContainText('12 objects updated', { timeout: 20000 });
  });
});
