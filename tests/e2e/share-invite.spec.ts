import { test, expect, type Browser, type Page } from '@playwright/test';

const TEST_PASSWORD = 'TestPassword123!';

function makeUniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@collabboard.dev`;
}

async function signUpAndLandOnBoards(page: Page, email: string): Promise<void> {
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

  await page.getByRole('button', { name: 'Already have an account? Sign in' }).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('/', { timeout: 10000 });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your Boards');
}

async function createBoardFromDashboard(page: Page): Promise<string> {
  await page.getByRole('button', { name: /create board/i }).click();
  await expect(page).toHaveURL(/\/board\/[a-f0-9-]+/, { timeout: 10000 });
  return page.url();
}

async function signUpFromLogin(page: Page, email: string): Promise<void> {
  await page.getByRole('button', { name: "Don't have an account? Sign up" }).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Sign up' }).click();

  const reachedTarget = await page
    .waitForURL(/\/board\/[a-f0-9-]+/, { timeout: 15000 })
    .then(() => true)
    .catch(() => false);

  if (reachedTarget) {
    return;
  }

  await page.getByRole('button', { name: 'Already have an account? Sign in' }).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/board\/[a-f0-9-]+/, { timeout: 10000 });
}

test.describe('Share Invite Session', () => {
  test.describe.configure({ mode: 'serial' });

  test('keeps invitee identity and returns to shared board after login', async ({ page, browser }) => {
    const inviterEmail = makeUniqueEmail('share-inviter');
    await signUpAndLandOnBoards(page, inviterEmail);
    const sharedBoardUrl = await createBoardFromDashboard(page);

    await expect(page.getByText(inviterEmail)).toBeVisible();

    const inviteeContext = await (browser as Browser).newContext();
    const inviteePage = await inviteeContext.newPage();
    const inviteeEmail = makeUniqueEmail('share-invitee');

    await inviteePage.goto(sharedBoardUrl);
    await expect(inviteePage).toHaveURL(/\/login\?next=/);

    await signUpFromLogin(inviteePage, inviteeEmail);
    await expect(inviteePage).toHaveURL(sharedBoardUrl);

    const joinButton = inviteePage.getByRole('button', { name: 'Join Board' });
    if (await joinButton.isVisible()) {
      await joinButton.click();
      await expect(inviteePage).toHaveURL(sharedBoardUrl);
    }

    await expect(inviteePage.getByText(inviteeEmail)).toBeVisible();
    await expect(inviteePage.getByText(inviterEmail)).not.toBeVisible();
    await inviteeContext.close();
  });
});
