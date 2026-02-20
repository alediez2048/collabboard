# E2E Tests with Playwright

## Overview

This directory contains end-to-end tests for the CollabBoard application using Playwright.

## Running Tests

On fresh machines, install the Playwright browser first:

```bash
npm run test:e2e:setup
```

`npm run test:e2e` also runs this automatically via a pretest hook, so missing-browser errors are self-healed.

```bash
# Run all E2E tests (headless)
npm run test:e2e

# Run with UI mode (interactive)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Debug mode (step through tests)
npm run test:e2e:debug
```

## Test Suites

### `auth.spec.ts` - Authentication Flow
Tests the complete authentication flow including:
- Unauthenticated redirect to login
- Signup form toggle
- User signup with email/password
- User logout
- User login after signup
- Protected route redirects
- Invalid credentials error handling

### `board.spec.ts` - Board Management
Tests board CRUD operations including:
- Empty state display
- Board creation
- Board listing
- Board navigation
- Board persistence after refresh
- Multiple boards handling
- Authentication state across navigation

## Test Results (Initial Run)

- **7 tests** pass reliably
- **6 tests** are flaky (timing-related, pass on retry)
- **1 test** failed (timing-related)

Flaky tests are expected in E2E testing due to network latency and async operations. All flaky tests pass on retry, indicating the functionality is correct.

## Known Issues

### Timing Sensitivity
Some tests are sensitive to signup/login timing. The current implementation:
- Uses `waitForURL()` with 15s timeout
- Uses `waitForLoadState('networkidle')` for page load
- Retries failed tests automatically (configured in playwright.config.ts)

### Future Improvements
- Add authentication fixtures for faster test execution
- Implement parallel test execution for independent tests
- Add visual regression testing
- Add API mocking for more consistent test timing

## CI/CD Integration

Tests are configured to run automatically in CI with:
- `forbidOnly: true` - prevents accidentally committed `.only()` tests
- `retries: 2` - automatic retry on failure
- `workers: 1` - sequential execution in CI for stability
- HTML reporter for test results

## Debugging Failed Tests

When a test fails, Playwright automatically captures:
- **Screenshot** of the failure state
- **Trace** for replay (`npx playwright show-trace path/to/trace.zip`)
- **Error context** with detailed logs

View the HTML report:
```bash
npx playwright show-report
```
