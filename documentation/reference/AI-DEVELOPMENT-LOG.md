# AI Development Log

Ticket: `TICKET-14`  
Project: CollabBoard (Gauntlet Assignment)  
Date: Feb 20, 2026

---

## 1) Workflow Used (Cursor + Claude-style Agent)

### Role split that worked

- **AI agent (Cursor):** drafted code/docs, proposed test cases, handled repetitive refactors, and generated first-pass patches.
- **Developer (human):** set architecture constraints, reviewed diffs, validated behavior manually, and approved final wording/claims.
- **Shared workflow:** ticket primer -> implement in scoped files -> run tests/build -> update `DEV-LOG` with evidence.

This pairing worked best when the prompt included strict scope, constraints, and explicit validation gates.

---

## 2) MCP/Automation Usage Notes

- Browser MCP was attempted early in the sprint for E2E-style verification, but reliability issues were recorded.
- Effective fallback was to prioritize deterministic Playwright/Vitest coverage plus targeted manual verification.
- Outcome: less time spent debugging the tooling itself, more time spent validating app behavior.

Reference notes were recorded in `documentation/tickets/DEV-LOG.md` (early tickets and testing reflections).

---

## 3) Prompts That Materially Improved Output Quality

The following prompt patterns produced consistently better outcomes:

1. **Ticket bootstrap context pack (high impact)**
   - Pattern: "Read `agents.md`, `PRD.md`, test guide, and previous ticket primers. Current state: ... Goal: ... Primary paths: ... Constraints: ... After completion: ..."
   - Why it worked: reduced context drift and forced implementation to stay aligned with architecture + acceptance criteria.

2. **TDD-first instruction (high impact)**
   - Pattern: "Write failing tests first, confirm failure, implement minimum code to pass, then refactor."
   - Why it worked: prevented speculative edits and caught regressions early on realtime/AI paths.

3. **Complex board template command (runtime validation)**
   - Prompt: `"Create a SWOT analysis"`
   - Why it worked: validated multi-step planning + deterministic executor path in one command.

4. **Follow-up reference command (runtime validation)**
   - Prompt: `"Move the note to x 500 y 300"`
   - Why it worked: exercised read-first follow-up behavior (`getBoardState` -> mutate existing object).

5. **High-volume deterministic command (runtime + performance validation)**
   - Prompt: `"Add 1000 green sticky notes"`
   - Why it worked: stress-tested deterministic bulk planning/execution and consistency guards.

---

## 4) Rough AI vs Human Code Contribution

This project did not track line-level authorship attribution automatically.  
Based on sprint workflow and review pass intensity:

- **AI-assisted first-pass output:** ~65-75%
- **Human-authored review/refinement/fixes:** ~25-35%

Interpretation: AI accelerated drafting and iteration; the human still owned correctness, architecture, and final quality bar.

---

## 5) Strengths Observed

- Fast first-pass implementation in well-scoped files.
- Strong support for repetitive scaffolding and test expansion.
- Useful at translating requirements into concrete patch sequences.
- Effective at maintaining momentum across many short tickets.

---

## 6) Limitations Observed

- Quality drops if prompts omit constraints or required files.
- AI can confidently propose stale assumptions unless grounded in current code.
- Tooling reliability (especially browser automation) can become a bottleneck.
- Final docs/claims still require human verification to avoid overstatement.

---

## 7) Key Learnings To Carry Forward

1. Provide strict context up front (state, scope, constraints, acceptance criteria).
2. Keep test-first discipline for any realtime or AI execution path.
3. Treat observability as a feature, not a post-hoc add-on.
4. Separate deterministic paths from LLM paths for reliability under load.
5. Require evidence-backed documentation before final submission.

---

## 8) Next Upgrade For Production Workflow

- Add lightweight metrics for AI contribution tracking (prompt catalog, accepted/rejected patch count, and review time).
- Export LangSmith/Langfuse trace snapshots per release to keep cost/perf reporting reproducible.
- Standardize a reusable "ticket kickoff prompt template" for future projects.
