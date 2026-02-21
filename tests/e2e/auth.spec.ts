import { test, expect } from '@playwright/test';

const TEST_PASSWORD = 'TestPassword123!';
const makeUniqueEmail = (suffix: string): string =>
  `auth-test-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@collabboard.dev`;

async function signUpAndReachHome(
  page: import('@playwright/test').Page,
  email: string,
): Promise<void> {
  await page.goto('/login');
  await page.click('text="Don\'t have an account? Sign up"');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');

  try {
    await page.waitForURL('/', { timeout: 25000 });
  } catch {
    // Some Supabase environments return a no-session sign-up response.
    // Fall back to explicit sign-in to keep tests deterministic.
    await page.click('text="Already have an account? Sign in"');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 15000 });
  }

  await page.waitForLoadState('networkidle');
}

test.describe('Authentication Flow', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('redirects unauthenticated user to login', async ({ page }) => {
    // Verify redirect to /login
    await expect(page).toHaveURL('/login');
    
    // Verify login page elements
    await expect(page.locator('h2')).toContainText('Sign in to CollabBoard');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('shows signup form when toggle clicked', async ({ page }) => {
    await page.goto('/login');
    
    // Initially should show sign in
    await expect(page.locator('h2')).toContainText('Sign in to CollabBoard');
    
    // Click toggle to sign up
    await page.click('text="Don\'t have an account? Sign up"');
    
    // Should now show sign up
    await expect(page.locator('h2')).toContainText('Create your account');
    await expect(page.locator('button[type="submit"]')).toContainText('Sign up');
  });

  test('allows user to sign up and redirects to home', async ({ page }) => {
    const email = makeUniqueEmail('signup');
    await signUpAndReachHome(page, email);
    
    // Should see "Your Boards" heading
    await expect(page.locator('h1')).toContainText('Your Boards');
    
    // Should see user email in dashboard chrome
    await expect(page.getByText(email).first()).toBeVisible();
    
    // Should see logout button
    await expect(page.locator('button:has-text("Log out")')).toBeVisible();
  });

  test('allows user to log out', async ({ page }) => {
    const email = makeUniqueEmail('logout');
    await signUpAndReachHome(page, email);
    
    // Click logout
    await page.click('button:has-text("Log out")');
    
    // Should redirect to login
    await page.waitForURL('/login', { timeout: 10000 });
    
    // Should see login form again
    await expect(page.locator('h2')).toContainText('Sign in to CollabBoard');
  });

  test('allows user to sign in after signing up', async ({ page }) => {
    const email = makeUniqueEmail('signin-after-signup');
    await signUpAndReachHome(page, email);
    
    // Log out
    await page.click('button:has-text("Log out")');
    await page.waitForURL('/login', { timeout: 10000 });
    
    // Sign back in
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Should redirect to home
    await page.waitForURL('/', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Your Boards');
  });

  test('protects board routes from unauthenticated users', async ({ page }) => {
    // Try to access a board directly
    await page.goto('/board/test-board-id');
    
    // Should redirect to login and preserve return path
    await expect(page).toHaveURL(/\/login\?next=%2Fboard%2Ftest-board-id/, { timeout: 5000 });
    await expect(page.locator('h2')).toContainText('Sign in to CollabBoard');
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    // Try to sign in with invalid credentials
    await page.fill('input[type="email"]', 'nonexistent@example.com');
    await page.fill('input[type="password"]', 'WrongPassword123!');
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.locator('text=/Invalid login credentials|Email not confirmed|User not found/i')).toBeVisible({ timeout: 5000 });
  });
});
