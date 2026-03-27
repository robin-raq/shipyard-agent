# AI Cost Analysis — Shipyard Agent

## 1. Development Costs (Actual)

### Token Usage (from LangSmith, last 100 traced runs)

| Metric | Value |
|--------|-------|
| Input tokens | 1,387,432 |
| Output tokens | 10,340 |
| Total tokens | 1,397,772 |
| Total traced runs | 174+ |
| Runs sampled for cost | 100 |

### Cost Breakdown by Model

| Model | Role | Input Cost ($/M) | Output Cost ($/M) | Est. Usage | Est. Cost |
|-------|------|------------------|--------------------|-----------|-----------|
| Claude Sonnet 4.5 | Backend/Frontend workers, single-agent | $3.00 | $15.00 | ~70% of runs | ~$3.02 |
| GPT-4o-mini | Supervisor, Shared/DB workers | $0.15 | $0.60 | ~30% of runs | ~$0.08 |
| **Total** | | | | | **~$3.10** |

Note: The $4.32 figure from LangSmith applies Sonnet pricing to all runs. Actual cost is lower because ~30% of runs used GPT-4o-mini at ~20x cheaper rates.

### Cost by Development Phase

| Phase | Dates | Runs | Est. Cost | Description |
|-------|-------|------|-----------|-------------|
| MVP Agent | Mar 23–24 | ~30 | ~$0.90 | Agent core, tools, REPL, tracing |
| Multi-Agent | Mar 24 | ~15 | ~$0.50 | Supervisor, workers, decomposition |
| Ship Scaffold | Mar 25 | ~20 | ~$0.60 | Initial monorepo, CRUD, Docker |
| Ship Features | Mar 26 | ~80 | ~$2.40 | 10 features in parallel (TDD) |
| Bug Fixes/Deploy | Mar 26–27 | ~29 | ~$0.70 | Fixes, hallucination guard, Railway |
| **Total** | | **~174** | **~$5.10** | |

### Infrastructure Costs

| Service | Cost | Notes |
|---------|------|-------|
| Railway (Ship app) | $0.00 | Free tier: 500 hours/month |
| Railway (PostgreSQL) | $0.00 | Free tier: 1GB storage |
| LangSmith | $0.00 | Free tier: 5K traces/month |
| GitHub | $0.00 | Free public repo |
| **Total infra** | **$0.00** | All within free tiers |

### Total Development Cost: ~$5.10

---

## 2. Production Cost Model

### Assumptions

- 10 invocations/user/day
- Average invocation: 4,000 input tokens + 2,000 output tokens
- Claude Sonnet pricing: $3/M input, $15/M output
- 70% Claude Sonnet / 30% GPT-4o-mini split (as built)

### Per-Invocation Cost

| Model | Input Cost | Output Cost | Blended | Weight | Weighted |
|-------|-----------|-------------|---------|--------|----------|
| Claude Sonnet | $0.012 | $0.030 | $0.042 | 70% | $0.029 |
| GPT-4o-mini | $0.0006 | $0.0012 | $0.0018 | 30% | $0.0005 |
| **Blended per invocation** | | | | | **$0.030** |

### Scaling Estimates

| Scale | Users | Daily Invocations | Monthly Cost |
|-------|-------|-------------------|-------------|
| Pilot | 10 | 100 | ~$90 |
| Team | 100 | 1,000 | ~$900 |
| Department | 1,000 | 10,000 | ~$9,000 |
| Enterprise | 10,000 | 100,000 | ~$90,000 |

### Cost Optimization Levers

| Lever | Savings | Tradeoff |
|-------|---------|----------|
| **Cache file reads** | 20-30% input tokens | Stale cache risk; invalidate on edit |
| **Haiku for list_files** | ~5% total cost | Slight latency reduction |
| **Prompt compression** | 15-25% input tokens | May lose context on long conversations |
| **Token budget caps** | Hard ceiling | May truncate complex tasks |
| **Batch similar tasks** | 10-15% per task | Higher latency per batch |

### Break-Even Analysis

Comparing agent cost vs. developer time for the Ship rebuild:

| Metric | Agent | Junior Dev (est.) | Senior Dev (est.) |
|--------|-------|-------------------|-------------------|
| Time to rebuild | ~6 hours active | ~40 hours | ~20 hours |
| API cost | $5.10 | $0 | $0 |
| Labor cost (@$50/hr) | $0 (hobby project) | $2,000 | $1,000 |
| Total | $5.10 | $2,000 | $1,000 |
| Lines produced | 16,818 | ~16,818 | ~16,818 |
| Cost per line | $0.0003 | $0.12 | $0.06 |

The agent is ~200-400x cheaper per line of code than manual development at market rates. The tradeoff is the 11 human interventions needed — the agent produces volume but requires human judgment for consistency, architecture, and infrastructure.

---

## 3. Cost Anomalies & Lessons

1. **Rate limit hits cost time, not money.** The 450K input tokens/minute rate limit on Anthropic's API caused 5 parallel agent sessions to stall. Each retry was free, but the wall-clock delay was ~15 minutes. Solution: stagger parallel launches by 30 seconds.

2. **Hallucination has real cost.** The supervisor hallucination (intervention #6) generated ~10 files that had to be manually deleted. Estimated wasted tokens: ~50K input + ~5K output = ~$0.22. The plan validation gate costs ~$0.01 per run and would have caught it.

3. **Multi-agent is cheaper per feature than single-agent.** Despite running 4-5 workers per task, multi-agent mode processes more features per dollar because workers share context and the supervisor routes simple tasks to GPT-4o-mini.

4. **Local trace files are free insurance.** The 174 JSON trace files cost nothing to store and provide full replay capability without querying LangSmith. They're the cheapest debugging tool in the stack.
