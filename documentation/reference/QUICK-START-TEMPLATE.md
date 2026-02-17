# Quick Start Template — New Project Checklist

**Use this checklist to start any new high-quality software project.**

---

## 📋 Day 1: Setup & Planning

### Hour 1-2: Project Initialization

```bash
# 1. Create repository
git init your-project
cd your-project

# 2. Initialize framework
npx create-next-app@latest . --typescript --tailwind --app

# 3. Create documentation structure
mkdir -p documentation/{agents,architecture,requirements,testing,tickets,reference}

# 4. Set up quality tools
npm install -D eslint prettier vitest @playwright/test
npx eslint --init
```

### Hour 3-4: Core Documentation

**Create these 5 files** (copy templates from DEVELOPMENT-METHODOLOGY.md):

1. **`documentation/requirements/PRD.md`**
   - Vision statement
   - User stories with acceptance criteria
   - Feature list (must-have, should-have, could-have)
   - Timeline with estimates

2. **`documentation/architecture/system-design.md`**
   - Data flow diagram
   - State ownership map
   - Architecture rules (non-negotiable)
   - Technology stack with rationale

3. **`documentation/agents/agents.md`**
   - One-paragraph summary
   - Architecture priorities (ordered)
   - Critical constraints
   - DO NOT list (anti-patterns)

4. **`documentation/testing/TESTS.md`**
   - Testing philosophy
   - Test types (unit, integration, E2E)
   - Per-ticket checklist
   - Coverage targets

5. **`documentation/tickets/DEV-LOG.md`**
   - Entry format template
   - Empty (will fill after each ticket)

### Hour 5: Break Down Tickets

Create ticket list in PRD:
```
- TICKET-01: [Foundation] Project scaffold + auth (2 hrs)
- TICKET-02: [Core Feature 1] Description (3 hrs)
- TICKET-03: [Core Feature 2] Description (2.5 hrs)
- TICKET-04: [Core Feature 3] Description (2 hrs)
...
```

**Estimate realistically:**
- Add 25% buffer for debugging
- Count setup time (env vars, deploys)
- Count testing time

---

## 🎫 Per-Ticket Workflow

**For EVERY ticket, follow this 8-step process:**

### Step 1: Write Primer (20 min)

Create `documentation/tickets/TICKET-XX-PRIMER.md`:
```markdown
# TICKET-XX: [Feature] — Primer

## Copy-Paste Context
[All context for fresh start]

## Objective
[One paragraph]

## What Already Exists
[Leverage prior work]

## What to Build
[Detailed spec]

## Technical Gotchas
[Known pitfalls + solutions]

## Testing Strategy
[What and how to test]
```

### Step 2: Create Branch (2 min)

```bash
git checkout main
git pull origin main
git checkout -b feat/feature-name
```

### Step 3: Write Tests First (20-30 min)

```bash
# Create test file
touch tests/unit/feature.test.ts

# Write test cases (should FAIL)
# Run to verify failures
npm test
```

### Step 4: Implement (60-90 min)

Write ONLY enough code to pass tests:
```bash
# Implement incrementally
# Run tests frequently
npm test
```

### Step 5: Quality Gates (5 min)

```bash
npm test           # ✅ All pass
npm run lint       # ✅ Clean
npm run build      # ✅ Compiles
```

### Step 6: Manual Testing (10 min)

- [ ] Feature works in browser
- [ ] No console errors
- [ ] Edge cases handled
- [ ] Multi-browser (if multiplayer)

### Step 7: Update Dev Log (10 min)

Add standardized entry to `DEV-LOG.md`:
- Metadata (time, branch, commit)
- Scope (what was built)
- Achievements (highlights)
- Technical implementation (key decisions)
- Issues & solutions
- Testing results
- Files changed
- Learnings (5 bullet points)

### Step 8: Commit & Merge (5 min)

```bash
git add .
git commit -m "feat(ticket-xx): descriptive message

- Bullet 1
- Bullet 2
- Bullet 3"

git push -u origin feat/feature-name

git checkout main
git merge feat/feature-name --no-ff
git push origin main
```

---

## 🎯 Quality Standards

### Before ANY Commit

```
✅ All tests pass
✅ Linter clean (0 errors, 0 warnings)
✅ TypeScript compiles (strict mode)
✅ No console errors
✅ Feature works manually
```

### Architecture Compliance

```
✅ Following system-design.md rules?
✅ No anti-patterns from agents.md?
✅ State ownership correct?
✅ Data flow matches diagram?
```

---

## 📊 Time Budget Template

**Standard ticket time:**
- Primer: 20 min
- Tests: 30 min
- Implementation: 90 min
- Quality gates: 5 min
- Manual testing: 10 min
- Dev log: 10 min
- Commit/merge: 5 min
- **Total: ~2.5 hours per ticket**

**Add time for:**
- First ticket: +30 min (setup overhead)
- Complex features: +60 min (algorithm design)
- Multi-browser features: +20 min (testing)
- Infrastructure: +30 min (deployment)

---

## 🚀 When to Deploy

**Deploy after every 2-3 tickets OR:**
- Major feature complete
- Breaking change
- Critical bug fix
- End of sprint

**Pre-deploy checklist:**
```bash
✅ All tests pass
✅ Build successful
✅ Manual regression test
✅ Env vars configured
✅ Database migrations (if any)
```

---

## 📚 Document Templates

### PRD Template

```markdown
# [Product] — PRD

## Vision
[One sentence]

## User Stories
- As a [role], I want [feature] so that [benefit]

## Features
### Must-Have (MVP)
1. Feature
   - Acceptance Criteria: [ ] [ ] [ ]
   - Estimate: X hrs

## Non-Goals
- NOT building [X] because [Y]

## Timeline
- Sprint 1: Tickets 1-5
```

### System Design Template

```markdown
# [Product] — System Design

## Data Flow Diagram
[ASCII/Mermaid]

## State Ownership Map
| State | Owner | Sync | Persistence |
|-------|-------|------|-------------|

## Architecture Rules
1. [System] is source of truth for [data]
2. NEVER [anti-pattern]
3. ALWAYS [pattern]

## Stack
- Framework: [X] - [Why]
- State: [Y] - [Why]
```

### Ticket Primer Template

```markdown
# TICKET-XX: [Feature] — Primer

## Objective
[What this accomplishes]

## What Already Exists
[Leverage prior work]

## What to Build
### Component 1
[Detailed spec]

## Data Flow
[How it works]

## Technical Gotchas
1. **[Issue]:** [Solution]

## Testing
- Unit: [What]
- Manual: [Checklist]
```

### Dev Log Template

```markdown
## TICKET-XX: [Feature] ✅

### 📋 Metadata
- Status: Complete
- Date: Feb XX, 2026
- Time: X hrs (est: Y hrs)
- Branch: feat/name

### 🎯 Scope
- ✅ Built feature 1
- ✅ Built feature 2

### 🏆 Key Achievements
- [Highlight 1]

### 🔧 Technical Implementation
[Key decisions]

### ⚠️ Issues & Solutions
| Issue | Solution |
|-------|----------|

### ✅ Testing
- X/X tests passing
- Manual: All pass

### 💡 Learnings
1. [Lesson 1]
```

---

## 🛠️ Essential Tools

### Required
- Git + GitHub
- Node.js + npm
- TypeScript
- ESLint
- Testing framework (Vitest/Jest)

### Recommended
- Prettier (formatting)
- Playwright (E2E tests)
- AI assistant (Cursor/Copilot)
- Mermaid (diagrams)

### Optional
- CI/CD (GitHub Actions)
- Monitoring (Sentry)
- Analytics

---

## ⚡ Power Tips

### 1. Write Primers Even for Solo Projects
"Future you" will thank you when returning after a break.

### 2. Tests Are Documentation
Good test names explain what the code does.

### 3. Architecture Rules Prevent Debates
Make big decisions once, reference them forever.

### 4. Dev Log While Fresh
Write the entry immediately after completing ticket. Details fade fast.

### 5. Quality Gates Are Non-Negotiable
It's faster to fix bugs before commit than after deploy.

---

## 📈 Success Metrics

**You're doing it right when:**
- ✅ Can resume work after days/weeks without confusion
- ✅ New developers productive within hours
- ✅ <5% time spent debugging
- ✅ Zero architecture debates during implementation
- ✅ AI assistants generate correct code first try
- ✅ Production bugs rare (<1 per sprint)

---

## 🎓 When to Use This

**Use this approach for:**
- ✅ Complex features (real-time, multiplayer)
- ✅ Team projects (2+ developers)
- ✅ Projects > 2 weeks
- ✅ High quality requirements

**Skip or simplify for:**
- ❌ Prototypes (throw-away code)
- ❌ Solo weekend projects
- ❌ Trivial CRUD apps
- ❌ Time-constrained hackathons

---

## 🔗 Related Documents

- Full methodology: `DEVELOPMENT-METHODOLOGY.md`
- CollabBoard example: All files in `documentation/`
- Template repository: [Link to your template repo]

---

**Total Setup Time:** 5 hours (Day 1)  
**Time Saved Per Ticket:** 30-60 min (less debugging)  
**ROI:** Positive after 3-4 tickets

_"An hour of planning saves three hours of debugging."_
