# Forge — Evaluation Report

_Generated 2026-06-04T03:56:20.055Z_

## Summary
| Metric | Value |
|---|---|
| Prompts | 20 |
| **Success rate** | **100%** |
| Success — real prompts | 100% |
| Success — edge cases | 100% |
| Edge graceful-handling | 100% |
| Avg repairs / request | 1.30 |
| Max repairs | 3 |
| Deterministic auto-fixes (total) | 10 |
| Latency p50 / p95 | 6.8s / 19.0s |
| Avg latency | 7.9s |
| Total tokens | 1,09,370 |
| Total cost (at paid rates) | $0.0037 |
| Avg cost / request | $0.00019 |

## Failure types
- none 🎉

## Per-prompt results
| ID | Category | OK | Repairs | Auto-fixed | Entities | Latency | Cost | Failed stage |
|---|---|---|---|---|---|---|---|---|
| r01 | real | ✅ | 1 | 0 | 2 | 4.7s | $0.00015 | — |
| r02 | real | ✅ | 1 | 0 | 5 | 6.7s | $0.00015 | — |
| r03 | real | ✅ | 1 | 3 | 4 | 4.4s | $0.00015 | — |
| r04 | real | ✅ | 1 | 1 | 3 | 6.5s | $0.00018 | — |
| r05 | real | ✅ | 1 | 0 | 4 | 6.8s | $0.00015 | — |
| r06 | real | ✅ | 1 | 1 | 4 | 4.6s | $0.00015 | — |
| r07 | real | ✅ | 2 | 1 | 6 | 7.7s | $0.00030 | — |
| r08 | real | ✅ | 2 | 0 | 4 | 6.8s | $0.00027 | — |
| r09 | real | ✅ | 1 | 1 | 5 | 7.2s | $0.00017 | — |
| r10 | real | ✅ | 1 | 1 | 5 | 4.9s | $0.00018 | — |
| e01 | edge/vague | ✅ | 2 | 0 | 1 | 4.2s | $0.00021 | — |
| e02 | edge/minimal | ✅ | 1 | 0 | 2 | 3.3s | $0.00016 | — |
| e03 | edge/vague | ✅ | 1 | 1 | 2 | 9.8s | $0.00017 | — |
| e04 | edge/conflicting | ✅ | 3 | 0 | 2 | 19.0s | $0.00027 | — |
| e05 | edge/incomplete | ✅ | 1 | 0 | 3 | 4.5s | $0.00017 | — |
| e06 | edge/conflicting | ✅ | 1 | 0 | 2 | 8.0s | $0.00017 | — |
| e07 | edge/adversarial | ✅ | 2 | 0 | 2 | 12.5s | $0.00023 | — |
| e08 | edge/adversarial | ✅ | 1 | 0 | 3 | 13.5s | $0.00016 | — |
| e09 | edge/incomplete | ✅ | 1 | 0 | 2 | 11.0s | $0.00017 | — |
| e10 | edge/conflicting | ✅ | 1 | 1 | 2 | 11.8s | $0.00015 | — |
