# TICKET-23: Neo-Brutalism UI Redesign — Full Frontend Reskin

**Use this to start TICKET-23 in a fresh Cursor agent session.**

---

## Copy-Paste This Into New Agent

```
Read @AGENTS.md, @documentation/requirements/PRD.md, @documentation/tickets/TICKET-23-PRIMER.md, and @documentation/tickets/DEV-LOG.md.

I'm working on TICKET-23: Neo-Brutalism UI Redesign.

Current state:
- The app is functionally complete (auth, canvas, real-time sync, AI agent, dashboard, comments)
- The visual style is generic boilerplate: white cards, gray-50 backgrounds, blue-600 buttons, Geist Sans font, standard Tailwind defaults with subtle shadows and rounded-xl corners
- There is no design system or theme layer — all colors/spacing are inline Tailwind classes

TICKET-23 Goal:
Reskin the entire frontend with a neo-brutalism aesthetic. The defining features are: thick black borders (2-3px), hard offset box-shadows (no blur), bright saturated accent colors, bold chunky typography, and a raw/playful visual energy. Light backgrounds, NOT dark mode. Everything should look like bold stickers slapped onto a canvas.

This is a VISUAL-ONLY refactor. Do NOT change any functionality, state management, API calls, Yjs logic, or component structure. Only Tailwind classes, CSS variables, fonts, and visual presentation should change.

Phase order (do them sequentially, verify each before moving on):

Phase 1 — Design tokens + global styles (@app/globals.css, @tailwind.config.ts or CSS theme)
Phase 2 — Layout shell: Navbar, login page, dashboard shell/sidebar (@components/Navbar.tsx, @app/login/page.tsx, @components/dashboard/DashboardSidebar.tsx, @components/dashboard/DashboardShell.tsx, @components/dashboard/DashboardTopStrip.tsx)
Phase 3 — Dashboard content: board cards, template gallery, buttons (@components/dashboard/DashboardBoardCard.tsx, @components/dashboard/DashboardSectionContent.tsx, @components/dashboard/DashboardTemplateGallery.tsx, @components/dashboard/DashboardBoardPreview.tsx, @components/dashboard/DashboardViewToggle.tsx, @components/dashboard/DashboardStarButton.tsx, @components/dashboard/DashboardSignOutButton.tsx, @components/board/CreateBoardButton.tsx, @components/board/DeleteBoardButton.tsx, @components/board/BoardNameEditable.tsx)
Phase 4 — Board chrome: header, toolbar, AI bar, HUD, overlays (@components/board/BoardHeader.tsx, @components/board/Toolbar.tsx, @components/board/AICommandBar.tsx, @components/board/PerformanceHUD.tsx, @components/board/PresenceBar.tsx, @components/board/ShareButton.tsx, @components/board/ColorPicker.tsx, @components/board/CommentThreadPanel.tsx, @components/board/JoinBoardPrompt.tsx, @components/board/ConfirmDialog.tsx)
Phase 5 — Canvas elements: grid, sticky notes, shapes, frames, connectors, cursors (@components/board/Grid.tsx, @components/board/StickyNote.tsx, @components/board/Shape.tsx, @components/board/Frame.tsx, @components/board/Connector.tsx, @components/board/RemoteCursorsLayer.tsx, @components/board/TextEditor.tsx)
Phase 6 — Polish pass: hover transforms, active press states, consistency audit

Constraints:
- NO functional changes — only CSS/Tailwind classes, fonts, and visual presentation
- Preserve all data-testid attributes and component APIs (props, callbacks)
- Preserve all accessibility attributes (aria-*, role, etc.)
- Keep Konva canvas rendering performant (avoid expensive CSS filters on canvas layers)
- The app must still build and pass lint after each phase
- Run `npm run build` after each phase to verify

After implementation:
- Run lint/build
- Manual walkthrough: login → dashboard → board → AI command → comment thread
- Screenshot before/after for DEV-LOG
- Update DEV-LOG and mark TICKET-23 complete
```

---

## Quick Reference

**Time Budget:** 6-8 hours (visual-only, no logic changes)  
**Branch:** `feat/neo-brutalism-redesign`  
**Dependencies:** All prior tickets complete  
**Risk:** Low (cosmetic-only, no state/logic changes)

---

## Objective

Transform CollabBoard from a generic white/gray/blue boilerplate into a bold neo-brutalism aesthetic — thick black borders, hard offset shadows, vivid saturated colors, chunky typography, and a raw, playful, sticker-like visual energy.

---

## Design Direction: Neo-Brutalism

### Mood & References
- Gumroad's 2022 redesign (the quintessential neo-brutalist app)
- Figma marketing pages, Linear's bold elements
- Indie web apps: read.cv, magical.fish, neobrutalism.dev
- Print zine / risograph poster aesthetics brought to screen

### Core Principles
1. **Thick black borders** — 2-3px solid black (`border-2 border-black`) on EVERYTHING: cards, buttons, inputs, badges
2. **Hard offset shadows** — no blur, black, offset down-right: `shadow-[4px_4px_0px_#000]` — this is the signature
3. **Bright flat colors** — vivid saturated fills as accent backgrounds, not as text color
4. **Light base** — off-white or warm white backgrounds, NOT dark mode
5. **Bold type** — chunky sans-serif, oversized headings, heavy weights
6. **No gradients, no blur, no glass** — everything is flat and raw
7. **Visible construction** — the UI should feel hand-assembled, not polished to sterility

### Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--nb-bg` | `#f5f0e8` | Page background (warm off-white / parchment) |
| `--nb-bg-card` | `#ffffff` | Card/panel background (pure white) |
| `--nb-border` | `#000000` | All borders (thick, black) |
| `--nb-shadow` | `#000000` | Hard offset shadows |
| `--nb-text` | `#1a1a1a` | Primary text |
| `--nb-text-muted` | `#6b6b6b` | Secondary/muted text |
| `--nb-accent-blue` | `#3b82f6` | Primary actions, links, selections |
| `--nb-accent-pink` | `#f472b6` | Secondary accent, shared badges, highlights |
| `--nb-accent-yellow` | `#facc15` | Stars, warnings, attention |
| `--nb-accent-green` | `#4ade80` | Success, online, connected |
| `--nb-accent-red` | `#f87171` | Destructive, errors, danger |
| `--nb-accent-purple` | `#a78bfa` | AI-related elements |
| `--nb-accent-orange` | `#fb923c` | Warm accents, saving indicator |
| `--nb-accent-lime` | `#a3e635` | Fresh accent, template badges |

### Typography
- **Primary font:** `'Space Grotesk'` (geometric sans with personality) — load via `next/font/google`
- **Mono font:** `'Space Mono'` or `'JetBrains Mono'` — for code-like UI (HUD, AI bar, timestamps)
- **Fallback:** `system-ui, sans-serif`
- Headings: `font-bold` or `font-black`, oversized (`text-2xl`–`text-4xl`)
- Labels/badges: `uppercase`, `tracking-wide`, `text-xs font-bold`
- Body: `font-medium` minimum — neo-brutalism avoids thin/light weights

### Visual Patterns

**The Neo-Brutal Card:**
```css
/* Every card, panel, input, button follows this skeleton */
.nb-card {
  background: var(--nb-bg-card);
  border: 2px solid var(--nb-border);
  box-shadow: 4px 4px 0px var(--nb-shadow);
}

/* On hover — shadow shifts to suggest press depth */
.nb-card:hover {
  box-shadow: 2px 2px 0px var(--nb-shadow);
  transform: translate(2px, 2px);
}

/* On active/press — fully flat, no shadow */
.nb-card:active {
  box-shadow: none;
  transform: translate(4px, 4px);
}
```

**Borders:**
- `border-2 border-black` on cards, inputs, buttons, badges, panels — EVERYWHERE
- NO `border-gray-200` or `border-gray-300` — always full black
- Corners: `rounded-lg` max (not `rounded-xl` or `rounded-2xl`) — keep it chunky, not pill-shaped

**Shadows:**
- Default: `shadow-[4px_4px_0px_#000]`
- Small elements: `shadow-[3px_3px_0px_#000]`
- Large/important: `shadow-[6px_6px_0px_#000]`
- Hover: shadow shrinks + translate to simulate press
- NO `shadow-sm`, `shadow-md`, `shadow-lg` — only hard offset shadows

**Colored Backgrounds (accent fills):**
- Buttons get colored backgrounds: `bg-[--nb-accent-blue]` with black border and shadow
- Badges/tags: bright fill + black border (e.g., "Shared" badge = pink fill, black border)
- Status dots: solid bright color, black border ring
- The color is BEHIND the text, not applied to text itself (black text on colored bg)

**Buttons:**
- Primary: colored bg (blue/purple) + `border-2 border-black` + `shadow-[4px_4px_0px_#000]` + black text + `font-bold uppercase`
- Destructive: red bg + black border + hard shadow
- Secondary/ghost: white bg + black border + hard shadow
- ALL buttons: hover = shadow shrinks + translate; active = flat
- Text on colored buttons: `text-black` or `text-white` depending on contrast

**Inputs:**
- `bg-white border-2 border-black shadow-[3px_3px_0px_#000]`
- Focus: blue or purple border (`border-[--nb-accent-blue]`) — shadow stays
- Placeholder text: `--nb-text-muted`
- Font: same as body (Space Grotesk), medium weight

**Status Indicators:**
- Online: bright green dot with `border-2 border-black`
- Saving: orange dot with black border
- Error: red dot with black border
- All dots are visible and chunky, not subtle

**Badges & Tags:**
- Bright colored fill + `border-2 border-black` + `rounded-md` + `text-xs font-bold uppercase`
- Examples: "Shared" = `bg-pink-300`, "Template" = `bg-lime-300`, "AI" = `bg-purple-300`

---

## Scope Details — Phase by Phase

### Phase 1: Design Tokens + Global Styles

**Files:** `app/globals.css`, `app/layout.tsx`

- Define all `--nb-*` CSS custom properties in `:root`
- Replace `--background` / `--foreground` with neo-brutalism values
- Add utility classes: `.nb-card` (border + shadow), `.nb-input` (border + shadow + focus), `.nb-btn` (hover/active transforms)
- Import fonts via `next/font/google` in `layout.tsx`: Space Grotesk (primary) + Space Mono (mono)
- Set `body` background to `--nb-bg`, text to `--nb-text`, font to Space Grotesk
- Remove the `prefers-color-scheme: dark` media query — the app is light-mode brutalist
- Add base transition: `* { transition: box-shadow 0.1s, transform 0.1s; }` for the press effect

**Verify:** `npm run build` passes, page loads with warm off-white bg and new fonts.

### Phase 2: Layout Shell

**Files:** `components/Navbar.tsx`, `app/login/page.tsx`, `components/dashboard/DashboardSidebar.tsx`, `components/dashboard/DashboardShell.tsx`, `components/dashboard/DashboardTopStrip.tsx`, `app/page.tsx`

- **Navbar:** White bg, `border-b-2 border-black`. Logo text in bold/black weight, large. Nav links bold. Sign-out button: red bg, black border, hard shadow
- **Login page:** Warm bg, centered white card with `border-2 border-black shadow-[6px_6px_0px_#000]`. Heading oversized and bold. Inputs with black borders and hard shadows. Submit button: blue bg, black border, hard shadow. Error messages: red bg badge with black border
- **Dashboard shell:** Warm `--nb-bg` background, remove all gray-50
- **Sidebar:** White bg, `border-r-2 border-black`. Nav items: bold text, active state = blue bg fill + black border. Search input: black border, hard shadow
- **Top strip:** White bg, `border-2 border-black shadow-[4px_4px_0px_#000]`. Section heading: oversized bold

**Verify:** Login → dashboard looks chunky, bold, and playful. No gray/subtle shadows remain. Build passes.

### Phase 3: Dashboard Content

**Files:** All `components/dashboard/Dashboard*.tsx`, `CreateBoardButton.tsx`, `DeleteBoardButton.tsx`, `BoardNameEditable.tsx`

- **Board cards:** White bg, `border-2 border-black shadow-[4px_4px_0px_#000]`. Hover: shadow shrinks, card translates. Shared badge: pink bg, black border. Preview thumbnail with `border-2 border-black`
- **Template gallery:** White card, black border, hard shadow. Template items: each one a mini card with border + shadow. "Use Template" button: lime/green bg, black border, bold
- **View toggle:** Black-bordered container, selected state = blue bg fill with black border
- **Star button:** Yellow bg when starred with black border, unstarred = white bg
- **Create board button:** Blue bg, `border-2 border-black shadow-[4px_4px_0px_#000]`, bold uppercase text, hover press effect
- **Delete button:** Red hover bg, black border
- **Board name editable:** Input with black border + hard shadow, save button = green bg, cancel = white
- **Sign-out button:** White bg, black border, hard shadow, red text
- **Empty states:** Dashed black border, muted text, bold heading

**Verify:** Dashboard feels like a magazine spread — bold, colorful, tactile. Build passes.

### Phase 4: Board Chrome

**Files:** All board overlay/UI components (non-canvas)

- **BoardHeader:** White bg, `border-2 border-black shadow-[4px_4px_0px_#000]`, `rounded-lg`. Back button: white, black border, hard shadow. Board name: bold display. Save status: colored dot with black border ring. Clear button: red bg, black border
- **Toolbar:** White bg, `border-2 border-black shadow-[4px_4px_0px_#000]`, vertical strip. Tool buttons: white bg when inactive, blue bg when selected — both with black borders. Hover press effect. Pencil controls popup: white card with black border + shadow
- **AICommandBar:** THE STAR — white bg, `border-3 border-black shadow-[6px_6px_0px_#000]`, `rounded-lg`. Input in mono font. Send button: purple bg, black border, bold uppercase "SEND". Status messages as colored badges: green bg for success, red bg for error, purple pulse for thinking. Should feel like a chunky command terminal sticker
- **PerformanceHUD:** White bg, `border-2 border-black shadow-[4px_4px_0px_#000]`. Mono font throughout. Metrics as colored badge pills (green/orange/red bg + black border). Feels like a retro instrument panel
- **PresenceBar:** Avatars with `border-2 border-black`, count text bold
- **ShareButton:** White bg, black border, hard shadow. Success: green bg transition
- **ColorPicker:** White popup, `border-2 border-black shadow-[4px_4px_0px_#000]`. Color swatches: each with `border-2 border-black`, selected = thicker border or scale bump
- **CommentThreadPanel:** White bg, `border-2 border-black shadow-[6px_6px_0px_#000]`. Messages in warm bg cards with thin black border. Author names bold. Compose input: black border. Send button: blue bg
- **JoinBoardPrompt:** Centered white card with `border-2 border-black shadow-[6px_6px_0px_#000]`. Join button: green bg, bold uppercase
- **ConfirmDialog:** Semi-transparent warm overlay. Dialog: white, `border-2 border-black shadow-[6px_6px_0px_#000]`. Confirm button: red bg. Cancel: white bg. Title: bold oversized

**Verify:** Board chrome is chunky and expressive. AI bar stands out with thicker border + purple accent. Build passes.

### Phase 5: Canvas Elements

**Files:** Konva components (Grid, StickyNote, Shape, Frame, Connector, RemoteCursorsLayer, TextEditor)

- **Canvas background:** Change from `bg-gray-50` to `--nb-bg` (warm off-white)
- **Grid:** Dot color: muted warm gray (`#ccc5b9`) — should be subtle on the warm bg
- **StickyNote:** Keep existing bright colors (yellow, pink, blue, green, orange, purple). Increase stroke to 2px black. Selection stroke: 3px `--nb-accent-blue`. Shadow: hard offset (`{ offsetX: 3, offsetY: 3, blur: 0, color: 'rgba(0,0,0,0.9)' }`)
- **Shape:** Black stroke (2px) on all shapes. Selection: blue. Shadow: hard offset, no blur
- **Frame:** Solid black border (not dashed) — 2px. Title: bold, black. Selection: blue
- **Connector:** Black stroke, slightly thicker. Selection: blue
- **FreehandStroke:** Keep user color, selection: blue
- **TextEditor:** White bg, `border-2 border-black`, bold font
- **RemoteCursorsLayer:** Keep user colors. Label bg: white, `border-2 border-black`, bold text. Sharp corners
- **Connection status overlays:** White cards with black borders, colored status dots with black rings
- **Comment pins:** Purple bg, `border-2 border-black`, white icon — chunky and visible

**Verify:** Canvas objects look like bold stickers on a warm canvas. Selection is clear. Objects are legible. Build passes.

### Phase 6: Polish Pass

- Ensure ALL interactive elements have the press effect: hover = shadow shrinks + translate(2px, 2px); active = shadow gone + translate(4px, 4px)
- Add subtle `hover:rotate-[-1deg]` to board cards for playfulness (optional)
- Audit — NO leftover `shadow-sm`, `shadow-md`, `shadow-lg`, `border-gray-*`, `bg-gray-50`, `rounded-xl`, `rounded-2xl` classes
- Audit — ALL cards/panels/inputs/buttons have `border-2 border-black`
- Check color contrast — black text on colored backgrounds must pass WCAG AA
- Check mobile breakpoints — responsive grid, toolbar, sidebar still work
- Ensure sticky note colors are legible with the 2px black stroke
- Test all hover/active states feel snappy (0.1s transition, no sluggishness)

**Verify:** Full walkthrough from login through AI command. Consistent brutalist aesthetic everywhere. Build + lint green.

---

## Technical Notes / Constraints

- **NO logic changes.** This ticket changes ONLY visual presentation (CSS classes, CSS variables, font imports). If a change would affect component behavior, state, props, API calls, or test assertions, it is OUT OF SCOPE.
- **Preserve all `data-testid` attributes** — tests depend on them.
- **Preserve all `aria-*` and `role` attributes** — accessibility must not regress.
- **Konva elements** are styled via props (fill, stroke, strokeWidth, shadowColor, shadowOffsetX, shadowOffsetY, shadowBlur), not CSS. Update those prop values directly in the component JSX.
- **Canvas performance:** Hard shadows (blur: 0) are CHEAPER than blurred shadows — this aesthetic is actually performance-friendly on Konva.
- **Font loading:** Use `next/font/google` for optimal loading. Apply font class to `<body>` in `layout.tsx`.
- **The hard shadow + translate press effect** should use CSS transitions (`transition: box-shadow 0.1s ease, transform 0.1s ease`) — do NOT use JavaScript animations for this.

---

## Testing / Verification Checklist

### After Each Phase
- `npm run build` passes (no TypeScript or import errors)
- `npm run lint` passes
- Manual visual check of affected area

### Final Manual Walkthrough
1. Login page renders with warm bg, bold card, black borders, hard shadow
2. Dashboard renders: sidebar, board cards, template gallery all brutalist-themed
3. Create a new board — chunky blue button, card appears with black border + shadow
4. Open a board — warm canvas, bold toolbar/header, AI bar with purple accent
5. Add a sticky note manually — appears with black stroke + hard shadow
6. Use AI command bar ("add 3 sticky notes") — purple send button, bold status message
7. Open comment thread — white panel, black border, chunky compose input
8. Check PerformanceHUD — mono font, colored metric badges
9. Hover over cards/buttons — press effect (shadow shrinks, element translates)
10. Resize browser — responsive layout still works
11. No subtle gray shadows, thin borders, or polished SaaS elements remain

### Automated
- `npm run build` — clean
- `npm run lint` — clean
- `npm test` — all existing tests pass (no functional changes)
- `npm run test:e2e` — if running, should pass (visual-only changes)

---

## Acceptance Criteria

- The entire app uses a neo-brutalism visual language — thick black borders and hard offset shadows on every interactive element.
- Bold sans-serif font (Space Grotesk) replaces the default throughout.
- Bright saturated colors are used as background fills on buttons, badges, and status indicators.
- The warm off-white base palette replaces all gray-50/white boilerplate backgrounds.
- All buttons and cards have the signature hover-press effect (shadow shrinks, element translates).
- The AI command bar has a distinct purple identity with a thicker border.
- Canvas objects have black strokes and hard shadows — they look like stickers.
- All functionality is preserved — zero behavioral regressions.
- Build, lint, and tests pass.
- The app looks like a bold creative tool, not a corporate SaaS template.

---

## Files Changed (Expected)

### Modified
- `app/globals.css` — design tokens, utility classes, base transitions
- `app/layout.tsx` — font imports
- `app/page.tsx` — dashboard background
- `app/login/page.tsx` — login styling
- `components/Navbar.tsx` — brutalist theme
- `components/dashboard/DashboardShell.tsx`
- `components/dashboard/DashboardSidebar.tsx`
- `components/dashboard/DashboardTopStrip.tsx`
- `components/dashboard/DashboardSectionContent.tsx`
- `components/dashboard/DashboardBoardCard.tsx`
- `components/dashboard/DashboardBoardPreview.tsx`
- `components/dashboard/DashboardViewToggle.tsx`
- `components/dashboard/DashboardStarButton.tsx`
- `components/dashboard/DashboardSignOutButton.tsx`
- `components/dashboard/DashboardTemplateGallery.tsx`
- `components/board/BoardHeader.tsx`
- `components/board/Toolbar.tsx`
- `components/board/AICommandBar.tsx`
- `components/board/PerformanceHUD.tsx`
- `components/board/PresenceBar.tsx`
- `components/board/ShareButton.tsx`
- `components/board/ColorPicker.tsx`
- `components/board/CommentThreadPanel.tsx`
- `components/board/JoinBoardPrompt.tsx`
- `components/board/ConfirmDialog.tsx`
- `components/board/Canvas.tsx` — background color, overlay styling
- `components/board/Grid.tsx` — dot color
- `components/board/StickyNote.tsx` — stroke, shadow props
- `components/board/Shape.tsx` — stroke, shadow props
- `components/board/Frame.tsx` — border style, title weight
- `components/board/Connector.tsx` — stroke width
- `components/board/FreehandStroke.tsx` — selection color
- `components/board/TextEditor.tsx` — input styling
- `components/board/RemoteCursorsLayer.tsx` — label styling
- `components/board/CreateBoardButton.tsx`
- `components/board/DeleteBoardButton.tsx`
- `components/board/BoardNameEditable.tsx`

### Not Changed
- Any file in `lib/`, `stores/`, `server/`, `types/`, `tests/` — NO logic changes
- `app/api/` — NO API changes
