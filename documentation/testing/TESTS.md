# CollabBoard — Testing Guide

**Project:** Real-Time Collaborative Whiteboard with AI Agent  
**Sprint:** Feb 16–23, 2026

This document is the single source of truth for all testing strategies, procedures, and checklists for the CollabBoard project.

---

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Testing Stack](#testing-stack)
3. [Testing Strategy by Ticket](#testing-strategy-by-ticket)
4. [Per-Ticket Testing Checklist](#per-ticket-testing-checklist)
5. [Running Tests](#running-tests)
6. [Multi-Browser Testing](#multi-browser-testing)
7. [Debugging Test Failures](#debugging-test-failures)
8. [CI/CD Integration](#cicd-integration)

---

## Testing Philosophy

**Core Principle:** Test after every ticket completion to catch bugs early and maintain quality baseline.

### Testing Pyramid

```
        /\
       /  \      E2E Tests (Playwright)
      /    \     - Slow, comprehensive
     /------\    - User flows, multiplayer sync
    /        \   
   /  Integration\   Integration Tests (Vitest)
  /    Tests      \  - Medium speed
 /                 \ - Server logic, Yjs sync
/-------------------\
    Unit Tests        Unit Tests (Vitest)
  - Fast, focused     - Component logic
  - State management  - Helper functions
```

**When to use each:**
- **E2E:** User-facing features, multiplayer sync
- **Integration:** Server logic, Yjs document sync, WebSocket behavior
- **Unit:** Component logic, state management, utility functions
- **Manual:** Visual quality, UX feel, performance perception

---

## Testing Stack

| Tool | Purpose | When to Use |
|------|---------|-------------|
| **Playwright** | E2E browser tests | User flows, multiplayer sync (TICKET-04+) |
| **Vitest** | Unit & integration tests | Component logic, Yjs sync (TICKET-03+) |
| **ESLint** | Code quality | Every commit |
| **TypeScript** | Type checking | Every build |
| **Manual Testing** | UX validation | Every ticket |

### Installed Dependencies

```json
{
  "@playwright/test": "^1.58.2",
  "vitest": "^4.0.18",
  "@testing-library/react": "^16.3.2",
  "@testing-library/jest-dom": "^6.9.1"
}
```

---

## Testing Strategy by Ticket

### TICKET-01: Project Scaffold + Auth ✅ Complete

**Tests Written:**
- ✅ 14 Playwright E2E tests (auth + board CRUD)
- ✅ API integration tests (curl-based)

**Coverage:**
- Authentication flow (signup, login, logout)
- Board creation and listing
- Protected route redirects
- Session persistence

**Status:** 7 passing reliably, 6 flaky (timing), 1 failed (timing)

---

### TICKET-02: Konva Canvas with Pan/Zoom

**Testing Approach: Manual + Simple E2E**

**Why skip extensive E2E:**
- Canvas rendering is visual/interactive
- Pan/zoom feel requires human perception
- Unit tests better for coordinate transforms
- No multiplayer behavior yet

**Manual Testing Checklist (5 min):**
- [ ] Canvas fills viewport
- [ ] Drag to pan - smooth at 60fps
- [ ] Mouse wheel zoom - responsive
- [ ] Zoom level displays correctly
- [ ] Grid/dot pattern scales with zoom
- [ ] No console errors
- [ ] Regression: Auth still works

**Optional E2E Test (5 min):**
```typescript
test('canvas loads and accepts input', async ({ page }) => {
  await page.goto('/board/123');
  await expect(page.locator('canvas')).toBeVisible();
  // Simple pan test
  await page.mouse.move(100, 100);
  await page.mouse.down();
  await page.mouse.move(200, 200);
  await page.mouse.up();
  // No crash = success
});
```

---

### TICKET-03: y-websocket Server + Yjs Provider

**Testing Approach: Integration Tests (Vitest) + Manual**

**Why skip E2E:**
- Backend infrastructure only
- No user-facing features yet
- Integration tests catch more bugs faster

**Vitest Integration Tests (15 min):**
```typescript
// tests/integration/yjs-sync.test.ts
test('two Yjs docs sync when connected', async () => {
  const doc1 = new Y.Doc();
  const doc2 = new Y.Doc();
  
  connectDocs(doc1, doc2);
  
  doc1.getMap('objects').set('sticky1', { x: 100, y: 200 });
  
  await waitForSync();
  expect(doc2.getMap('objects').get('sticky1')).toEqual({ x: 100, y: 200 });
});

test('WebSocket connection requires JWT', async () => {
  const wsUrl = 'ws://localhost:4000';
  
  // Should reject without token
  await expect(connectWithoutAuth(wsUrl)).rejects.toThrow();
  
  // Should accept with valid token
  await expect(connectWithAuth(wsUrl, validJWT)).resolves.toBe('connected');
});
```

**Manual Testing Checklist (5 min):**
- [ ] Open browser console → see "Yjs connected" log
- [ ] Network tab → WebSocket connection (ws://)
- [ ] No connection errors
- [ ] Open 2 tabs → both show "connected"
- [ ] Logged out user rejected (if auth implemented)
- [ ] Regression: Canvas pan/zoom still works

---

### TICKET-04: Sticky Note CRUD via Yjs ✅ Critical E2E Tests

**Testing Approach: E2E (Playwright) + Manual Multi-Browser**

**Why E2E is essential:**
- First user-facing multiplayer feature
- Tests full stack integration
- Verifies Yjs sync works end-to-end

**Playwright E2E Tests (15 min):**
```typescript
// tests/e2e/sticky-notes.spec.ts
test('sticky note creation syncs to second browser', async ({ browser }) => {
  const page1 = await browser.newPage();
  const page2 = await browser.newPage();
  
  await page1.goto('/board/123');
  await page2.goto('/board/123');
  
  // Create in page1
  await page1.click('button:has-text("Add Sticky Note")');
  await page1.click('[data-canvas]', { position: { x: 100, y: 200 } });
  
  // Verify in page2
  await expect(page2.locator('.sticky-note')).toBeVisible({ timeout: 2000 });
});

test('sticky note movement syncs', async ({ browser }) => {
  // Similar setup, test drag sync
});

test('text editing syncs', async ({ browser }) => {
  // Test double-click edit → text sync
});
```

**Manual Testing Checklist (10 min):**

**Single Browser:**
- [ ] Create note → appears
- [ ] Drag note → moves smoothly
- [ ] Double-click → text editor
- [ ] Edit text → saves
- [ ] Change color → updates
- [ ] Delete (Backspace) → disappears

**Multi-Browser:**
- [ ] Open 2 browsers to same board
- [ ] Create in A → appears in B (< 1 sec)
- [ ] Move in A → position updates in B
- [ ] Edit in A → text updates in B
- [ ] Delete in A → disappears in B
- [ ] Simultaneous edits → no conflicts

---

### TICKET-05: Multiplayer Cursors via Socket.io ✅ E2E Tests

**Playwright E2E Tests (10 min):**
```typescript
// tests/e2e/cursors.spec.ts
test('cursor movement syncs between browsers', async ({ browser }) => {
  const page1 = await browser.newPage();
  const page2 = await browser.newPage();
  
  await page1.goto('/board/123');
  await page2.goto('/board/123');
  
  await page1.mouse.move(300, 300);
  
  await expect(page2.locator('.remote-cursor')).toBeVisible();
  // Verify position, name label, no echo
});
```

**Manual Testing Checklist (5 min):**
- [ ] Move in A → cursor shows in B
- [ ] Cursor has user name label
- [ ] Position updates smoothly (not jumpy)
- [ ] No "echo" (don't see own cursor)
- [ ] Distinct color per user
- [ ] Close A → cursor disappears in B (< 2 sec)
- [ ] Zoom/pan → cursor position correct

---

### TICKET-06: Presence Awareness ✅ E2E Tests

**Playwright E2E Tests (10 min):**
```typescript
// tests/e2e/presence.spec.ts
test('presence updates when users join/leave', async ({ browser }) => {
  const page1 = await browser.newPage();
  await page1.goto('/board/123');
  
  await expect(page1.locator('.presence-bar')).toContainText('1');
  
  const page2 = await browser.newPage();
  await page2.goto('/board/123');
  
  await expect(page1.locator('.presence-bar')).toContainText('2');
  await expect(page2.locator('.presence-bar')).toContainText('2');
  
  await page2.close();
  await expect(page1.locator('.presence-bar')).toContainText('1', { timeout: 5000 });
});
```

**Manual Testing Checklist (5 min):**
- [ ] Open board → see yourself in presence bar
- [ ] Open 2nd browser → both users show
- [ ] User count correct (2)
- [ ] Distinct color/avatar per user
- [ ] Close A → removed from B (< 3 sec)
- [ ] Reopen → re-appears

---

### TICKET-07: State Persistence (Yjs → Supabase) ✅ Critical E2E Tests

**Playwright E2E Tests (10 min):**
```typescript
// tests/e2e/persistence.spec.ts
test('objects persist after reload', async ({ page }) => {
  await page.goto('/board/123');
  
  // Create objects
  await createStickyNote(page, 'Test Note 1');
  await createStickyNote(page, 'Test Note 2');
  
  // Reload page
  await page.reload();
  
  // Verify objects still there
  await expect(page.locator('text=Test Note 1')).toBeVisible();
  await expect(page.locator('text=Test Note 2')).toBeVisible();
});

test('objects persist after closing all tabs', async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto('/board/123');
  
  await createStickyNote(page, 'Persistent Note');
  await page.close();
  
  await new Promise(r => setTimeout(r, 5000)); // Wait for debounced save
  
  const newPage = await browser.newPage();
  await newPage.goto('/board/123');
  
  await expect(newPage.locator('text=Persistent Note')).toBeVisible();
});
```

**Manual Testing Checklist (10 min):**
- [ ] Create 3 notes with different text/colors
- [ ] Refresh → all 3 still there
- [ ] Close all tabs, wait 5s
- [ ] Reopen → all 3 still there
- [ ] Open 2nd browser → same 3 notes
- [ ] User A creates, User B creates, both close
- [ ] Reopen → both users' notes present

---

### TICKET-08+: Shapes, Selection, AI Agent

**Add E2E tests incrementally (5-10 min per ticket):**
- 1-2 tests per major feature
- Focus on user-facing functionality
- Test AI commands end-to-end

---

## Per-Ticket Testing Checklist

**After completing each ticket, follow this workflow:**

### 1. Run Automated Tests (2-5 min)

```bash
# Linter
npm run lint

# TypeScript + Build
npm run build

# Unit/Integration tests (TICKET-03+)
npm test

# E2E tests (TICKET-04+)
npm run test:e2e
```

**Fix any failures before proceeding.**

---

### 2. Manual Smoke Test (5-10 min)

**Test the new feature:**
- Happy path (expected usage)
- One edge case (empty state, max values)
- Visual quality check
- Performance perception

**Check browser console:**
- No red errors
- No warnings (unless expected)
- WebSocket connected (TICKET-03+)

---

### 3. Regression Test (2-5 min)

**Quick check previous features still work:**
- [ ] Auth: Can log in
- [ ] Boards: Can create board
- [ ] Canvas: Can pan/zoom (TICKET-02+)
- [ ] Sticky notes: Can create/edit (TICKET-04+)
- [ ] Cursors: Show in 2nd browser (TICKET-05+)

---

### 4. Multi-Browser Test (5 min, TICKET-04+)

**For multiplayer features:**
- [ ] Open 2 browser windows (or incognito)
- [ ] Test sync behavior
- [ ] Verify changes appear in both (< 1 sec)
- [ ] Test simultaneous actions

**Tools:**
- Chrome + Chrome Incognito
- Chrome + Firefox
- 2 separate browser profiles

---

### 5. Performance Check (1 min)

**Quick eyeball test:**
- [ ] Feels fast/smooth (60fps)
- [ ] No obvious lag
- [ ] No memory leaks (DevTools Performance)
- [ ] Network: WebSocket stable, no reconnects

---

### 6. Document & Commit (3 min)

```bash
# Stage files
git add .

# Commit
git commit -m "feat(ticket-XX): description"

# Update documentation/tickets/DEV-LOG.md with test results
# Mark ticket complete in documentation/tickets/TICKETS.md

# Push
git push origin main
```

---

## Running Tests

### E2E Tests (Playwright)

```bash
# Install Chromium once on fresh machines (optional)
npm run test:e2e:setup

# Run all E2E tests (headless)
npm run test:e2e

# Interactive mode (best for development)
npm run test:e2e:ui

# Watch the browser (see what's happening)
npm run test:e2e:headed

# Debug step-by-step
npm run test:e2e:debug

# Run single test file
npx playwright test tests/e2e/auth.spec.ts

# Run single test
npx playwright test tests/e2e/auth.spec.ts:25
```

`npm run test:e2e` automatically runs a pretest browser install (`playwright install chromium`) to prevent missing-executable failures on fresh environments.

**See also:** `tests/e2e/README.md` for detailed Playwright documentation.

---

### Unit/Integration Tests (Vitest)

```bash
# Run all tests
npm test

# Watch mode
npm test -- --watch

# Run single file
npm test -- tests/integration/yjs-sync.test.ts

# Coverage report
npm test -- --coverage
```

---

### Linter & Build

```bash
# Lint check
npm run lint

# Lint + auto-fix
npm run lint -- --fix

# Build check (verifies TypeScript)
npm run build

# Local dev server
npm run dev
```

---

## Multi-Browser Testing

### Setup for Manual Testing

**Option 1: Incognito Windows**
1. Open normal Chrome window → log in as User A
2. Open Chrome Incognito → log in as User B
3. Navigate both to same board
4. Test sync behavior

**Option 2: Browser Profiles**
1. Chrome → Settings → Add Person → Create "Test User A"
2. Create "Test User B" profile
3. Open board in both profiles
4. Better for repeated testing

**Option 3: Different Browsers**
1. Chrome + Firefox
2. Chrome + Safari
3. Good for cross-browser testing

---

### Playwright Multi-Browser Tests

Playwright automatically handles multiple browser contexts:

```typescript
test('multi-browser sync', async ({ browser }) => {
  // Page 1 (User A)
  const page1 = await browser.newPage();
  await page1.goto('/board/123');
  
  // Page 2 (User B)
  const page2 = await browser.newPage();
  await page2.goto('/board/123');
  
  // Test sync between page1 and page2
  await page1.click('button:has-text("Add Note")');
  await expect(page2.locator('.sticky-note')).toBeVisible();
});
```

---

## Debugging Test Failures

### Playwright Failures

**Automatic captures on failure:**
- Screenshot (`test-results/.../test-failed-1.png`)
- Trace (`test-results/.../trace.zip`)
- Error context (`test-results/.../error-context.md`)

**View trace (most useful):**
```bash
npx playwright show-trace test-results/path/to/trace.zip
```

Trace includes:
- Timeline of all actions
- Screenshots at each step
- Network requests
- Console logs

**View HTML report:**
```bash
npx playwright show-report
```

---

### Common Test Issues

**Flaky tests (timing):**
- Increase timeout: `{ timeout: 15000 }`
- Add wait: `await page.waitForLoadState('networkidle')`
- Use auto-retry (already configured)

**Element not found:**
- Check selector is correct
- Verify element is visible: `await expect(locator).toBeVisible()`
- Wait for element: `await page.waitForSelector('.my-element')`

**WebSocket issues:**
- Check server is running
- Verify JWT is valid
- Check Network tab for WS connection

**Yjs sync issues:**
- Verify both browsers connected
- Check console for Yjs errors
- Test with 2+ second delay

---

### Debugging Tips

1. **Use headed mode:** `npm run test:e2e:headed` - watch browser
2. **Use debug mode:** `npm run test:e2e:debug` - step through
3. **Add `page.pause()`** in test - manual inspection
4. **Check console logs:** `page.on('console', msg => console.log(msg.text()))`
5. **Screenshot manually:** `await page.screenshot({ path: 'debug.png' })`

---

## CI/CD Integration

### GitHub Actions (Future - TICKET-13)

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm test
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
```

---

### Pre-Deploy Checklist

**Before deploying to Vercel:**

```bash
# 1. All tests pass
npm run lint
npm run build
npm test
npm run test:e2e

# 2. Manual smoke test on localhost
npm run dev
# Test critical flows

# 3. Commit and push
git push origin main

# 4. Verify Vercel deployment succeeds
# 5. Manual smoke test on production URL
# 6. Check Sentry/logs for errors (future)
```

---

## Test Maintenance

### Keep Tests Fast
- Use fixtures for auth (login once, reuse)
- Run independent tests in parallel
- Skip E2E for unit-testable logic
- Mock external APIs when possible

### Keep Tests Reliable
- Avoid hard-coded waits (`sleep()`)
- Use `waitFor*` patterns
- Handle timing with retries
- Increase timeouts for slow operations

### Keep Tests Maintainable
- Use page objects for common actions
- Extract helper functions
- Document flaky tests
- Update tests when features change

---

## Red Flags - Stop and Debug

⚠️ **Stop development if you see:**

- Console errors (red text)
- WebSocket disconnection messages
- "Sync failed" or Yjs errors
- Objects not syncing (> 1 sec delay)
- Memory leaks (DevTools Performance)
- Build failures
- Linter errors
- Test failures (not flaky)

**Debug immediately** - bugs compound!

---

## Testing Time Budget

| Ticket | Test Type | Time Budget |
|--------|-----------|-------------|
| TICKET-01 | E2E + API | 30 min (done) |
| TICKET-02 | Manual | 5-10 min |
| TICKET-03 | Integration | 15 min |
| TICKET-04 | E2E + Manual | 25 min |
| TICKET-05 | E2E + Manual | 15 min |
| TICKET-06 | E2E + Manual | 15 min |
| TICKET-07 | E2E + Manual | 20 min |
| TICKET-08+ | Incremental | 10-15 min each |

**Total testing time across project:** ~2.5-3 hours

**Value:** Prevents hours of debugging, ensures quality, enables confident deployment.

---

## Success Metrics

**Healthy test suite indicators:**
- ✅ All tests pass (or flaky, not failed)
- ✅ E2E tests cover critical user flows
- ✅ Integration tests cover sync logic
- ✅ Manual testing catches UX issues
- ✅ No console errors in production
- ✅ < 1 second sync latency
- ✅ 60fps canvas performance

---

## Resources

- **Playwright Docs:** https://playwright.dev/docs/intro
- **Vitest Docs:** https://vitest.dev/guide/
- **Yjs Testing Guide:** https://docs.yjs.dev/
- **E2E Test Examples:** `tests/e2e/README.md`
- **DEV-LOG:** Testing notes after each ticket

---

**Last Updated:** Feb 16, 2026  
**Maintained By:** Development Team

_Test early, test often, ship confidently._ ✅
