# TICKET-02 Kickstart Primer

**Use this to start TICKET-02 in a fresh Cursor agent session.**

---

## Copy-Paste This Into New Agent:

```
Read @documentation/agents/agents.md, @documentation/architecture/system-design.md, @documentation/requirements/PRD.md, and @documentation/testing/TESTS.md.

I'm working on TICKET-02: Konva Canvas with Pan/Zoom.

Current state:
- ✅ TICKET-01 is COMPLETE and deployed
- ✅ Next.js 15 scaffold with TypeScript strict mode
- ✅ Supabase Auth working (email/password)
- ✅ Protected route at /board/[id] with auth middleware
- ✅ Board list page, create board functionality
- ✅ Deployed to Vercel: https://collabboard-gauntlet.vercel.app
- ✅ Playwright E2E tests set up (14 tests)
- ✅ Git workflow established, all code on main branch
- ✅ Supabase CLI configured and authenticated

What's NOT done yet:
- ❌ No canvas rendering yet (board page is a placeholder)
- ❌ No Konva.js installed
- ❌ No pan/zoom functionality
- ❌ No toolbar component

Current /board/[id] page shows a placeholder div with text "Canvas will go here (TICKET-02)".

TICKET-02 Goal:
Install konva and react-konva, create a full-viewport Konva Stage in /board/[id], 
implement infinite pan (drag) and zoom (mouse wheel), add a dot grid background 
that scales with zoom, display zoom level in UI, and add a toolbar stub (visual only).

Check @app/board/[id]/page.tsx before starting. Don't overwrite existing code.
Follow the file structure in @documentation/reference/presearch.md section 13.

After completion, follow the TICKET-02 testing checklist in @documentation/testing/TESTS.md.
```

---

## Context Summary for Agent

### What TICKET-01 Delivered

**Files Created:**
- `app/page.tsx` - Board list with create button
- `app/login/page.tsx` - Auth (signup/login toggle)
- `app/board/[id]/page.tsx` - Protected board page (PLACEHOLDER - needs canvas)
- `components/navbar.tsx` - Nav with logout
- `components/create-board-button.tsx` - Board creation
- `lib/supabase/client.ts` + `server.ts` - Supabase clients
- `middleware.ts` - Route protection
- `stores/ui-store.ts` - Zustand (selectedTool, zoom)
- `types/board.ts` - Board interface

**Infrastructure:**
- Supabase project: `ifagtpezakzdztufnyze`
- Database: `boards` table with RLS
- Vercel: https://collabboard-gauntlet.vercel.app
- GitHub: https://github.com/alediez2048/Gauntlet-Assignment-1
- Testing: Playwright E2E, API integration tests

**Current Branch:** `main` (clean, no uncommitted changes)

---

### TICKET-02 Scope (from documentation/requirements/PRD.md)

**Time budget:** 1.5 hours  
**Dependencies:** TICKET-01 ✅  
**Branch:** `feat/canvas`

**Acceptance Criteria:**
- [ ] Canvas fills the viewport on the board page
- [ ] User can pan by dragging empty space
- [ ] User can zoom with mouse wheel (smooth, 60fps)
- [ ] Zoom level is displayed
- [ ] No objects yet — this is just the empty canvas

**Implementation Details:**
- Install `konva` and `react-konva`
- Create `components/board/Canvas.tsx` — full-viewport Konva Stage
- Implement infinite pan (Stage `draggable` prop)
- Implement zoom (wheel event, adjust `scaleX/scaleY`)
- Add subtle grid/dot pattern background
- Display current zoom level in UI
- Toolbar component stub (no tools active, just visual bar)

---

### Key Constraints from Rules

1. **Zustand for UI state ONLY** - Use `stores/ui-store.ts` for pan/zoom state
2. **DO NOT touch Yjs** - Not until TICKET-03
3. **TypeScript strict mode** - No `any` types
4. **60fps requirement** - Canvas must be performant
5. **Follow file structure** - Canvas component goes in `components/board/`

---

### File to Modify

**Primary:** `app/board/[id]/page.tsx`

**Current contents:**
```tsx
// Shows placeholder div:
<div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
  <p>Canvas will go here (TICKET-02)</p>
  <p>Board ID: {board.id}</p>
</div>
```

**Action:** Replace placeholder with `<Canvas boardId={board.id} />`

---

### Files to Create

1. `components/board/Canvas.tsx` - Main Konva Stage component
2. `components/board/Toolbar.tsx` - Toolbar stub (visual only)
3. `components/board/Grid.tsx` - Optional: Grid background layer

---

### Zustand Store Update

**Current state in `stores/ui-store.ts`:**
```typescript
selectedTool: 'select' | 'sticky' | 'rectangle' | ...
zoom: number
```

**May need to add:**
```typescript
pan: { x: number; y: number }
```

---

### Testing Requirements (from documentation/testing/TESTS.md)

**After completion:**

1. **Automated:**
   ```bash
   npm run lint
   npm run build
   ```

2. **Manual (5 min):**
   - [ ] Canvas fills viewport
   - [ ] Drag to pan - smooth at 60fps
   - [ ] Mouse wheel zoom - responsive
   - [ ] Zoom level displays correctly
   - [ ] Grid scales with zoom
   - [ ] No console errors
   - [ ] Regression: Auth still works

3. **Optional E2E:**
   ```typescript
   test('canvas loads and accepts input', async ({ page }) => {
     await page.goto('/board/123');
     await expect(page.locator('canvas')).toBeVisible();
     // Simple pan test
   });
   ```

4. **Update Documentation:**
   - Mark TICKET-02 complete in `documentation/tickets/TICKETS.md`
   - Add entry to `documentation/tickets/DEV-LOG.md`

---

### Konva.js API Reference

**Key concepts:**
- `Stage` - Top-level canvas container
- `Layer` - Rendering layer (like Photoshop layers)
- `Shape` - Drawable elements (Rect, Circle, Text, etc.)

**Pan implementation:**
```tsx
<Stage
  draggable
  onDragEnd={(e) => {
    const stage = e.target;
    setPan({ x: stage.x(), y: stage.y() });
  }}
>
```

**Zoom implementation:**
```tsx
const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
  e.evt.preventDefault();
  const stage = e.target.getStage();
  const oldScale = stage.scaleX();
  const pointer = stage.getPointerPosition();
  
  const newScale = e.evt.deltaY > 0 ? oldScale * 0.95 : oldScale * 1.05;
  
  stage.scale({ x: newScale, y: newScale });
  
  // Adjust position to zoom toward pointer
  const newPos = {
    x: pointer.x - (pointer.x - stage.x()) * (newScale / oldScale),
    y: pointer.y - (pointer.y - stage.y()) * (newScale / oldScale),
  };
  stage.position(newPos);
};

<Stage onWheel={handleWheel}>
```

**Docs:** https://konvajs.org/docs/

---

### Common Gotchas

1. **Canvas must fill viewport** - Use `width={window.innerWidth}` or similar
2. **Handle window resize** - Add resize listener
3. **Zoom feels better with limits** - Min 0.1x, max 10x
4. **Pan position can go infinite** - That's OK for now
5. **Grid performance** - Use simple dots, not complex patterns

---

### Definition of Done

**Code complete when:**
- [ ] User can pan by dragging
- [ ] User can zoom with mouse wheel
- [ ] Zoom level displayed (e.g., "100%")
- [ ] Grid/dots visible and scale correctly
- [ ] Canvas fills viewport
- [ ] No console errors
- [ ] 60fps performance (manually verified)

**Ticket complete when:**
- [ ] All code complete criteria met
- [ ] Tests pass (lint, build, manual)
- [ ] documentation/tickets/DEV-LOG.md updated
- [ ] documentation/tickets/TICKETS.md updated
- [ ] Committed to `feat/canvas` branch
- [ ] Pushed to GitHub
- [ ] Merged to `main`

---

### Expected Output

After TICKET-02, the board page should:
1. Display a full-screen canvas (Konva Stage)
2. Show a toolbar at the top (empty stub, styled nicely)
3. Show zoom level indicator (e.g., "100%" in corner)
4. Show dot grid background
5. Allow smooth pan and zoom
6. Feel responsive (60fps)

**No objects yet** - just the empty, interactive canvas.

---

### Time Management

**Estimated: 1.5 hours**

- Install deps: 2 min
- Canvas component: 30 min
- Pan logic: 15 min
- Zoom logic: 20 min
- Grid background: 15 min
- Toolbar stub: 10 min
- Testing: 10 min
- Documentation: 5 min
- Commit/push: 3 min

**Total: ~1.5 hours**

---

### Dependencies to Install

```bash
npm install konva react-konva
npm install -D @types/konva
```

---

### Quick Reference Links

- PRD TICKET-02: Line 85-107 in `documentation/requirements/PRD.md`
- Testing checklist: Search "TICKET-02" in `documentation/testing/TESTS.md`
- File structure: `documentation/reference/presearch.md` section 13
- Zustand store: `stores/ui-store.ts`

---

**Ready to start TICKET-02!** 🚀

Copy the primer above into a new Cursor chat and the agent will have full context to continue seamlessly.
