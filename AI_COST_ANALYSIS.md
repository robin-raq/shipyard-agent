# AI Cost Analysis — Shipyard Agent

## 1. Development Costs (Actual)

### Token Usage

| Metric | Value |
|--------|-------|
| Total traced runs | 243+ |
| Total agent-generated features | 24 |
| Total batch sprints | 4 |

### Cost Breakdown by Model

| Model | Role | Input Cost ($/M) | Output Cost ($/M) | Est. Usage | Est. Cost |
|-------|------|------------------|--------------------|-----------|-----------|
| Claude Sonnet 4.5 | Single-agent, early workers | $3.00 | $15.00 | ~30% of runs | ~$3.50 |
| GPT-4o-mini | Supervisor, shared/DB workers | $0.15 | $0.60 | ~20% of runs | ~$0.10 |
| GPT-4o | Workers in batches 1-3 | $2.50 | $10.00 | ~30% of runs | ~$5.00 |
| GPT-5 | Backend/frontend workers (batch 3) | $3.00 | $15.00 | ~20% of runs | ~$4.00 |
| **Total API cost** | | | | **243 runs** | **~$12.60** |

### Cost by Development Phase

| Phase | Dates | Runs | Est. Cost | Description |
|-------|-------|------|-----------|-------------|
| MVP Agent | Mar 23–24 | ~30 | ~$0.90 | Agent core, tools, REPL, tracing |
| Multi-Agent | Mar 24 | ~15 | ~$0.50 | Supervisor, workers, decomposition |
| Ship Scaffold | Mar 25 | ~20 | ~$0.60 | Initial monorepo, CRUD, Docker |
| Ship Features | Mar 26 | ~80 | ~$2.40 | 10 features in parallel (TDD) |
| Bug Fixes/Deploy | Mar 26–27 | ~29 | ~$0.70 | Fixes, hallucination guard, Railway |
| Kanban Sprint | Mar 28 | ~15 | ~$0.50 | 7 kanban+standups tasks |
| Agent Improvements | Mar 28 | ~10 | ~$0.40 | gather_context, contract, verify_task |
| Batch 1 (6 features) | Mar 28 | ~20 | ~$1.50 | Activity, attachments, sprint reviews, settings, notifications, org chart |
| Batch 2 (5 features) | Mar 29 | ~15 | ~$1.50 | MyWeek, status overview, profile, invitations, associations |
| Batch 3 (13 features) | Mar 29 | ~30 | ~$3.00 | FleetGraph, admin, middleware, backlinks, tokens, setup, iterations |
| Test Generation | Mar 29 | ~10 | ~$0.60 | Tests for 5 routes missing coverage |
| **Total** | | **~274** | **~$12.60** | |

### Infrastructure Costs

| Service | Cost | Notes |
|---------|------|-------|
| Railway (Ship app) | $0.00 | Free tier: 500 hours/month |
| Railway (PostgreSQL) | $0.00 | Free tier: 1GB storage |
| LangSmith | $0.00 | Free tier: 5K traces/month |
| GitHub | $0.00 | Free public repo |
| **Total infra** | **$0.00** | All within free tiers |

### Total Development Cost: ~$13

---

## 2. Production Cost Model

### Assumptions

- 10 invocations/user/day
- Average invocation: 4,000 input tokens + 2,000 output tokens
- 60% GPT-4o / 20% GPT-4o-mini / 20% Claude Sonnet split
- Role-scoped context reduces tokens ~60% vs full context

### Per-Invocation Cost

| Model | Input Cost | Output Cost | Blended | Weight | Weighted |
|-------|-----------|-------------|---------|--------|----------|
| GPT-4o | $0.010 | $0.020 | $0.030 | 60% | $0.018 |
| GPT-4o-mini | $0.0006 | $0.0012 | $0.0018 | 20% | $0.0004 |
| Claude Sonnet | $0.012 | $0.030 | $0.042 | 20% | $0.008 |
| **Blended per invocation** | | | | | **$0.027** |

### Scaling Estimates

| Scale | Users | Daily Invocations | Monthly Cost |
|-------|-------|-------------------|-------------|
| Pilot | 10 | 100 | ~$81 |
| Team | 100 | 1,000 | ~$810 |
| Department | 1,000 | 10,000 | ~$8,100 |
| Enterprise | 10,000 | 100,000 | ~$81,000 |

### Cost Optimization Levers

| Lever | Savings | Tradeoff |
|-------|---------|----------|
| **Smart verify (implemented)** | 8.7x fewer verification runs | Misses some edit-time type errors |
| **Role-scoped context (implemented)** | ~60% fewer context tokens | Workers see less of the codebase |
| **Cache file reads** | 20-30% input tokens | Stale cache risk |
| **Prompt compression** | 15-25% input tokens | May lose context |
| **Batch similar tasks** | 10-15% per task | Higher latency |

### Break-Even vs. Manual Development

| Metric | Agent | Junior Dev (est.) | Senior Dev (est.) |
|--------|-------|-------------------|-------------------|
| Time to rebuild | ~10 hours active (6 days) | ~80 hours | ~40 hours |
| Features built | 24 autonomous + FleetGraph | ~24 | ~24 |
| API cost | ~$13 | $0 | $0 |
| Labor cost (@$50/hr) | $0 (project) | $4,000 | $2,000 |
| Total | ~$13 | $4,000 | $2,000 |
| Cost per feature | $0.54 | $167 | $83 |
| Human interventions | 27 | 0 | 0 |

The agent is **150-300x cheaper** than manual development. The tradeoff: 27 human interventions for auth patterns, missing files, deployment config, and runtime verification.

---

## 3. Cost Anomalies & Lessons

1. **Smart verify saved the most money.** Batch 2 averaged 2,780s/task (full tsc+vitest per worker). Batch 3 averaged 321s/task (skip verify for new files). Same cost per LLM call, 8.7x less wall-clock time and fewer timeout-induced retries.

2. **Hallucination costs compound.** The supervisor hallucination (~$0.22 wasted) was cheap. The `happy-dom@^13.10.2` hallucination broke Docker builds for 3 deploy cycles — hours of debugging for a $0.001 LLM output. Prevention (version check) is infinitely cheaper than recovery.

3. **Shared contracts pay for themselves 100x.** One $0.004 LLM call prevented cross-boundary mismatches that previously required $0.30-1.00 in worker retries per failure.

4. **Multi-agent is cheaper per feature than sequential single-agent.** Workers share context and the supervisor routes simple tasks to GPT-4o-mini. 13 features in 70 minutes at ~$3 total = $0.23/feature.

5. **Post-deploy fixes are the hidden cost.** The 8 post-deploy interventions (auth, migrations, lockfile, seed data) consumed more human time than the 24 autonomous features saved. Runtime verification would eliminate most of these.
