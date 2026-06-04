# Forge — A Compiler for Software Generation

**Natural language → structured config → validated → executable → working app.**

Forge treats app generation like a **compiler**, not a prompt. The LLM is only the *parser front-end* that turns a request into a typed intermediate representation (IR); everything downstream — schema generation, validation, repair, and code-gen — is **deterministic TypeScript**. The LLM never has the final say on structure, which is what makes the output reliable under pressure.

- **Live demo:** https://forge-compiler-rust.vercel.app
- **Repository:** https://github.com/amal0307/forge-compiler
- Inspired by [base44.com](https://base44.com)

---

## The thesis

Most "AI app builders" are one big prompt that returns JSON. They break the moment requirements shift. Forge inverts that — most of the reliability comes from non-LLM code:

| Compiler stage | Forge |
|---|---|
| Lex / Parse | **Intent Extraction** (LLM) |
| Semantic analysis to IR | **System Design to ArchitectureIR** (LLM) |
| Type checking | **Validation engine** (Zod + cross-reference checks) |
| Optimization passes | **Repair engine** (deterministic auto-fix + targeted re-gen) |
| Code generation | **Deterministic backend** to DB / API / UI / Auth |
| Runtime / VM | **In-browser interpreter** renders a working app |

Only the two creative, ambiguous steps use the LLM. The four structural steps are pure code, so cross-layer consistency (UI binding to API field to DB column) is **guaranteed by construction** — not hoped for.

---

## Pipeline

```
  Natural-language prompt
        |
        v  Stage 1  INTENT EXTRACTION        LLM (low-temp, JSON) -> IntentIR
        |           entities, roles, features, integrations + ambiguity flags
        |
        v  Stage 2  SYSTEM DESIGN            LLM -> ArchitectureIR
        |           typed entities + relations, roles, permissions, plans, rules
        |
        v  Stage 4  VALIDATION + REPAIR      deterministic (core)
        |           Zod (structural) -> semantic checks -> auto-fix / targeted re-gen
        |
        v  Stage 3  SCHEMA GENERATION        deterministic codegen (no LLM)
        |           ArchitectureIR -> DB . API . UI . Auth
        |
        v  Stage 5  LINK + CROSS-LAYER CHECK deterministic safety net
        |
        v  RUNTIME  in-browser interpreter   renders a clickable app with
                    seeded data, RBAC, and premium gating enforced
```

Every arrow crosses a strict Zod contract. Invalid output never propagates.

---

## What makes it reliable (control over the LLM)

- **Strict contracts everywhere** — each stage's output is a Zod schema; structurally invalid output is rejected, not used.
- **Validate to repair loop** (`generateStructured`) — generate, parse, validate against the exact schema; on failure, re-prompt with the *specific* Zod errors and escalate to a stronger model. Never a blind full retry.
- **Deterministic semantic validation** — orphan permissions, references to non-existent entities, gating without a plan, missing default role, etc. are caught by code, then auto-repaired (or the offending stage is re-generated with the violations injected).
- **Deterministic codegen** — DB/API/UI/Auth are derived from the validated IR, so they cannot drift out of sync. The cross-layer safety net confirms it.
- **Security and correctness built in** — secrets (`password`) are writable but never returned; one-to-many foreign keys land on the child table; role + plan gating are derived and enforced in the runtime.
- **Low temperature, per-model rate limiting, tiered models** for stability and cost.

---

## Evaluation

20 prompts — 10 real products + 10 edge cases (vague / conflicting / incomplete / adversarial). Full report: [`EVAL_REPORT.md`](./EVAL_REPORT.md). Re-run anytime via `GET /api/eval`.

| Metric | Result |
|---|---|
| **Success rate** | **100%** (20/20) |
| — real prompts | 100% (10/10) |
| — edge cases | 100% (10/10), all gracefully handled |
| Avg repairs / request | 1.3 (max 3) |
| Deterministic auto-fixes | 10 |
| Latency p50 / p95 | 6.8s / 19.0s |
| Cost / request | ~$0.0002 at paid rates — $0 on free tier |
| Total cost (20 prompts) | $0.0037 across 109k tokens |

**Highlights**

- Every vague/incomplete prompt — "Build me an app for my business", "notes app", "A calculator" — was flagged ambiguous and still produced a runnable app with documented assumptions.
- The self-contradictory forum prompt took 3 repair passes and still resolved to a consistent schema.
- One real prompt failed on the first attempt (non-determinism) and failed cleanly (`ok:false`, no malformed output); it passed on retry.

---

## Cost vs quality

- **Tiered models:** a cheap fast model (`llama-3.1-8b-instant`) for intent; a stronger model (`llama-4-scout` / `llama-3.3-70b`) for architecture; escalation to the stronger model only when a repair is needed.
- Most requests are **2 LLM calls** — schema generation is deterministic, so it adds zero calls and zero hallucination surface (about one-third the cost of an all-LLM design).
- Entire 20-prompt eval: **$0.0037** at paid rates.

---

## Tech stack

Next.js 16 (App Router) + TypeScript, Zod contracts, Groq (Llama 3.x / Llama 4 Scout) via `groq-sdk`, an in-browser React runtime with an in-memory store (no database to host), deployed on Vercel.

---

## Project structure

```
src/
  ir/           typed contracts — the "language" the compiler speaks
  llm/          Groq client + generateStructured (validate + repair wrapper)
  pipeline/     stage1 intent . stage2 design . stage4 refine . compile
  compiler/     deterministic codegen: db . api . auth . ui
  validation/   structural (Zod) . semantic . cross-layer
  components/   AppPreview — the in-browser runtime
  config/       model tiers + pricing . system prompts
  eval/         dataset (20 prompts) . runner . metrics
  app/          page.tsx (UI) . api/compile . api/eval
```

---

## Run locally

```bash
git clone https://github.com/amal0307/forge-compiler.git
cd forge-compiler
npm install
```

Create `.env.local` (free Groq key from https://console.groq.com/keys):

```bash
GROQ_API_KEY=your_key
GROQ_MODEL_FAST=llama-3.1-8b-instant
GROQ_MODEL_BASE=meta-llama/llama-4-scout-17b-16e-instruct
GROQ_MODEL_PRO=meta-llama/llama-4-scout-17b-16e-instruct
LLM_MAX_RPM=20
```

```bash
npm run dev          # http://localhost:3000
```

- **Generate an app:** enter a prompt, click Compile, then inspect the pipeline, validation report, JSON tabs, and the live App preview (switch Role/Plan to see RBAC and premium gating enforced).
- **Run the eval:** `GET http://localhost:3000/api/eval` writes `EVAL_REPORT.md` and `eval-results.json`.

---

## How it handles a messy request

1. **Intent Extraction** parses the prompt into a typed `IntentIR` and flags ambiguity (vague / conflicting / underspecified), proposing minimal assumptions.
2. **System Design** expands intent into a full `ArchitectureIR`: entities with typed fields and relations, roles, permissions, plans, and business rules.
3. **Validation + Repair** runs deterministic checks over the architecture. Auto-fixable issues are repaired in code; if errors remain, the stage is re-generated with the exact violations injected.
4. **Schema Generation** deterministically lowers the validated architecture into DB, API, UI, and Auth schemas — consistent by construction.
5. **Link + Cross-layer Check** assembles the final spec and verifies every cross-reference resolves.
6. **Runtime** interprets the spec into a clickable app with seeded data, enforced role-based access, and premium gating.

---

## Limitations and honest notes

- Targets data-driven CRUD apps; pure-computation or real-time apps (calculator, chat) degrade to the nearest data model rather than crashing.
- Determinism is stable but not bit-exact — temperature-0 LLMs still vary on GPU; measured by re-running.
- The runtime is an in-memory interpreter (no persistence; tables show raw foreign-key ids, no join resolution).
- Row-level `own` scope is modeled in the spec but not enforced in the preview.
- Free-tier daily token caps apply; production would use a paid tier.
```