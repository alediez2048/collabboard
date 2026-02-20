# AI Cost Analysis

Ticket: `TICKET-14`  
Project: CollabBoard (Gauntlet Assignment)  
Date: Feb 20, 2026

---

## 1) Data Sources Used

This analysis is grounded in real trace output captured during development:

1. **Runtime command traces** emitted by `lib/ai-agent/tracing.ts` and logged as:
   - `[AI] ai-board-command | ... | ... tokens | $...`
   - `[AI] ai-board-command-followup | ... | ... tokens | $...`
2. **Captured dataset:** `72` traced commands from local development terminal logs.
3. **Estimator implementation:** `lib/ai-agent/tracing.ts` uses:
   - `COST_PER_1K_INPUT = 0.00015`
   - `COST_PER_1K_OUTPUT = 0.0006`

Important: costs below are **estimated** from token usage using in-code pricing constants; they are not direct billing exports.

---

## 2) Observed Development Usage (Trace Sample)

### Aggregate metrics

| Metric | Value |
|---|---|
| Commands sampled | 72 |
| Total tokens | 126,829 |
| Total estimated cost | $0.031166 |
| Avg tokens / command | 1,761.51 |
| Avg cost / command | $0.000433 |
| Avg latency / command | 9,030ms |
| Median latency | 1,678ms |
| P90 latency | 31,982ms |
| P95 latency | 35,233ms |

### Command-type breakdown

| Command type | Count | Share | Avg tokens | Avg cost | Avg latency |
|---|---:|---:|---:|---:|---:|
| `ai-board-command` | 53 | 73.6% | 1,106.68 | $0.000300 | 7,086ms |
| `ai-board-command-followup` | 19 | 26.4% | 3,588.16 | $0.000804 | 14,453ms |

### Tail behavior (cost outliers)

Top observed command costs in the sample:
- $0.002715
- $0.002401
- $0.002126
- $0.002032
- $0.001215

These correspond to long-running or high-context commands (large object context, follow-up paths, or bulk operations).

---

## 3) Projection Model (100 / 1k / 10k / 100k Users)

### Assumptions

- 30-day month
- 5 AI commands per active user per day
- Command mix follows observed trace sample (73.6% single-step, 26.4% follow-up)
- Baseline cost per command: **$0.000433** (observed blended average)
- Conservative cost per command: **$0.001097** (observed P90 command cost)

Formula:

`monthly_cost = users * commands_per_user_per_day * 30 * cost_per_command`

### Monthly projection

| Active users | Commands / month | Token volume / month (est.) | Baseline monthly AI cost | Conservative monthly AI cost (P90) |
|---:|---:|---:|---:|---:|
| 100 | 15,000 | 26,422,650 | $6.50 | $16.46 |
| 1,000 | 150,000 | 264,226,500 | $64.95 | $164.55 |
| 10,000 | 1,500,000 | 2,642,265,000 | $649.50 | $1,645.50 |
| 100,000 | 15,000,000 | 26,422,650,000 | $6,495.00 | $16,455.00 |

---

## 4) Per-User Cost Sensitivity

Using observed blended cost per command ($0.000433):

| Commands per user per day | Estimated AI cost per user / month |
|---:|---:|
| 2 | $0.0260 |
| 5 | $0.0650 |
| 10 | $0.1299 |
| 20 | $0.2598 |

---

## 5) Development Spend Notes

- **Observed OpenAI command spend in sampled traces:** **$0.031166** (~3.1 cents).
- This reflects only the captured trace sample, not necessarily the entire project lifetime.
- **Cursor subscription/tooling cost:** not usage-metered per repository in this dataset, so excluded from totals.
- **LangSmith/Langfuse platform cost:** not included here (separate plan/account-level billing).

---

## 6) Caveats and Next Update Step

1. Refresh this analysis with dashboard exports before final submission:
   - LangSmith project usage snapshot
   - Langfuse usage snapshot
2. If model pricing changes, update constants in `lib/ai-agent/tracing.ts` and regenerate projections.
3. Keep projection assumptions explicit (commands/day, user activity mix, follow-up ratio) when presenting externally.
