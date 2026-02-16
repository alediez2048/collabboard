import { test, expect } from '@playwright/test';

const TEST_EMAIL = `board-test-${Date.now()}@collabboard.dev`;
const TEST_PASSWORD = 'TestPassword123!';

test.describe('Board Management', () => {
  test.beforeEach(async ({ page }) => {
    // Sign up before each test
    await page.goto('/login');
    await page.click('text="Don\'t have an account? Sign up"');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for redirect and page load
    await page.waitForURL('/', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
  });

  test('shows empty state when no boards exist', async ({ page }) => {
    // Should see "Your Boards" heading
    await expect(page.locator('h1')).toContainText('Your Boards');
    
    // Should see create board button
    await expect(page.locator('button:has-text("Create Board")')).toBeVisible();
    
    // Should see empty state message
    await expect(page.locator('text=/No boards yet|Create your first board/i')).toBeVisible();
  });

  test('allows user to create a board', async ({ page }) => {
    // Click create board button
    await page.click('button:has-text("Create Board")');
    
    // Should redirect to board page
    await expect(page).toHaveURL(/\/board\/[a-f0-9-]+/, { timeout: 10000 });
    
    // Should see board name "Untitled Board"
    await expect(page.locator('h1')).toContainText('Untitled Board', { timeout: 5000 });
    
    // Should see canvas placeholder text
    await expect(page.locator('text="Canvas will go here (TICKET-02)"')).toBeVisible();
  });

  test('displays created board in board list', async ({ page }) => {
    // Create a board
    await page.click('button:has-text("Create Board")');
    await expect(page).toHaveURL(/\/board\/[a-f0-9-]+/);
    
    // Go back to home
    await page.click('a:has-text("CollabBoard")');
    await expect(page).toHaveURL('/');
    
    // Should see the created board in the list
    await expect(page.locator('text=Untitled Board')).toBeVisible();
    
    // Should see creation date
    await expect(page.locator('text=/Created/i')).toBeVisible();
  });

  test('allows user to navigate to board from list', async ({ page }) => {
    // Create a board
    await page.click('button:has-text("Create Board")');
    const boardUrl = page.url();
    const boardId = boardUrl.split('/').pop();
    
    // Go back to home
    await page.click('a:has-text("CollabBoard")');
    
    // Click on the board card
    await page.click('text=Untitled Board');
    
    // Should navigate to the board
    await expect(page).toHaveURL(`/board/${boardId}`, { timeout: 5000 });
    await expect(page.locator('h1')).toContainText('Untitled Board');
  });

  test('persists board after page refresh', async ({ page }) => {
    // Create a board
    await page.click('button:has-text("Create Board")');
    await expect(page).toHaveURL(/\/board\/[a-f0-9-]+/);
    const boardUrl = page.url();
    
    // Refresh the page
    await page.reload();
    
    // Should still show the board
    await expect(page).toHaveURL(boardUrl);
    await expect(page.locator('h1')).toContainText('Untitled Board');
  });

  test('shows multiple boards when created', async ({ page }) => {
    // Create first board
    await page.click('button:has-text("Create Board")');
    await expect(page).toHaveURL(/\/board\/[a-f0-9-]+/);
    
    // Go back and create second board
    await page.click('a:has-text("CollabBoard")');
    await page.click('button:has-text("Create Board")');
    await expect(page).toHaveURL(/\/board\/[a-f0-9-]+/);
    
    // Go back to home
    await page.click('a:has-text("CollabBoard")');
    
    // Should see two boards
    const boardCards = page.locator('text=Untitled Board');
    await expect(boardCards).toHaveCount(2);
  });

  test('maintains authentication across board navigation', async ({ page }) => {
    // Create a board
    await page.click('button:has-text("Create Board")');
    await expect(page).toHaveURL(/\/board\/[a-f0-9-]+/);
    
    // Should still see user email in navbar
    await expect(page.locator('text=' + TEST_EMAIL)).toBeVisible();
    
    // Should still see logout button
    await expect(page.locator('button:has-text("Log out")')).toBeVisible();
  });
});
