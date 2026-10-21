# End-to-end tests (Playwright)

Four browser suites that drive the real app:

| File | Covers |
|---|---|
| `auth.spec.ts` | Redirect when signed out, sign up, sign in, sign out, bad credentials |
| `board.spec.ts` | Dashboard sections, templates, starring, search, renaming and deleting boards, share links, canvas delete and clear, comment pins, AI move targeting |
| `share-invite.spec.ts` | An invitee opening a shared board link, signing in, and landing back on that board |
| `text-tool.spec.ts` | Placing and editing a text object on the canvas |

## Running them

These tests sign up real users, so they need a Supabase project (the same `.env.local` values the app uses) with email sign-up enabled. They are not part of CI for that reason; CI runs the Vitest unit and integration suites.

```bash
npm run test:e2e:setup   # once: installs Chromium for Playwright
npm run test:e2e         # starts `npm run dev` and runs the suites headless
npm run test:e2e:ui      # interactive mode
```

Each test creates its own user with a random email, so runs don't collide. The sign-up flow falls back to an explicit sign-in when the Supabase project doesn't return a session on sign-up.

When a test fails, Playwright saves a screenshot and a trace; `npx playwright show-report` opens them.
