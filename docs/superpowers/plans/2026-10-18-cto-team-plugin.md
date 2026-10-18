# cto-team Plugin (Part A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `cto-team` Claude Code plugin: `/cto-team:plan` (built-in planning) and `/cto-team:deliver` (CTO runs gate-by-gate delivery with ≤3 fresh Sonnet workers, a blind verifier and ≤2 fix rounds per gate, then a CEO report).

**Architecture:** A plugin with two skills. `deliver` is a short CTO playbook plus reference prompts; each gate runs `workflows/gate.js` through the Workflow tool, which spawns worker/verifier/fixer agents with JSON schemas and returns one compact result. Agents read prompts and briefs from files; the CTO only reads compact results and its own ledger. `plan` is a compact CEO-interview → spec → plan path whose plan format is exactly what `deliver` reads.

**Tech Stack:** Markdown skills, plain-JS Workflow script, JSON manifests, Node 24 `node:test` for tests (no npm dependencies), `claude plugin validate`.

**Spec:** `docs/superpowers/specs/2026-10-18-cto-team-design.md`

## Global Constraints

- Skill and prompt text in English; CEO-facing output in the CEO's chat language.
- `skills/deliver/SKILL.md` under 150 lines; `skills/plan/SKILL.md` under 150 lines.
- Max 3 workers per gate; max 2 fix rounds per gate; workers, verifier and fixer use model `sonnet`.
- Workers are one-shot. Never continue a worker with `SendMessage`.
- CTO never edits product code or tests and never drives a browser.
- `gate.js`: plain JavaScript, no TypeScript, no `Date.now()`, `Math.random()`, argless `new Date()`, no filesystem API; begins with `export const meta = {...}` as a pure literal.
- Critical/Important verifier findings block a gate; Critical items (security, data loss, money/number correctness, auth/permissions, main-path crash) never go to tech debt.
- Real tests are kept; temporary files are deleted before a gate passes.
- Plugin never edits the installer's settings; recommended settings live in README only.
- License MIT; `NOTICE` credits obra/superpowers (MIT) and olsenbrands/fable-foreman (MIT).
- Search with `rg`, never `grep` (owner's machine blocks grep via hook).
- No npm dependencies; tests run with `node --test tests/`.

## Review Focus

1. A gate given more than 3 tasks, or tasks sharing files → must be rejected, not silently run (Task 2 test `rejects more than 3 tasks`; Task 4 rule on disjoint file sets).
2. A worker or verifier agent that dies (`agent()` returns `null`) → gate must be FAIL/BLOCKED, never PASS (Task 2 tests `null worker` and `null verifier`).
3. Verifier says `verdict: "PASS"` but lists a failing Critical/Important criterion or junk → script must override to FAIL (Task 2 test `script overrides lenient verifier`).
4. Mutation check leaves the tree modified (`restored: false`) → gate BLOCKED so the CTO does not commit broken code (Task 2 test `unrestored mutation blocks`).
5. Windows project paths with spaces and backslashes (`D:\AI\My Project`) → every path in prompts is quoted and passed verbatim (Task 2 test `quotes paths with spaces`).

---

## File Structure

```
.claude-plugin/plugin.json            plugin manifest
.claude-plugin/marketplace.json       single-plugin marketplace (source "./")
LICENSE, NOTICE, README.md, .gitignore, package.json (scripts.test only)
skills/deliver/SKILL.md               CTO playbook
skills/deliver/workflows/gate.js      one gate
skills/deliver/references/gate-brief.md
skills/deliver/references/worker-prompt.md
skills/deliver/references/verifier-prompt.md
skills/deliver/references/fixer-prompt.md
skills/deliver/references/test-policy.md
skills/deliver/references/report-template.html
skills/plan/SKILL.md
skills/plan/references/spec-template.md
skills/plan/references/plan-template.md
skills/plan/references/plan-review-prompt.md
tests/harness.mjs                     loads gate.js with mocked agent/parallel
tests/gate.test.mjs
tests/structure.test.mjs              manifests, frontmatter, required rules, links
tests/e2e-check.mjs                   checks a delivered project's artifacts
```

---

### Task 1: Repo scaffold and manifests

**Files:**
- Create: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `LICENSE`, `NOTICE`, `.gitignore`, `package.json`
- Test: `tests/structure.test.mjs`

**Interfaces:**
- Produces: plugin name `cto-team`, version `0.1.0`; marketplace name `cto-team`; install id `cto-team@cto-team`. `tests/structure.test.mjs` exports nothing; later tasks append `test(...)` blocks to it.

- [ ] **Step 1: Write the failing tests** in `tests/structure.test.mjs` using `node:test` + `node:assert/strict`, reading files relative to repo root:
  - `manifest has name, version, description, license MIT`: `plugin.json` parses; `name === 'cto-team'`, `version === '0.1.0'`, `license === 'MIT'`, `description.length > 20`, `author.name === 'nhattrung0911'`.
  - `marketplace lists the plugin at repo root`: `marketplace.json` parses; `name === 'cto-team'`; `plugins.length === 1`; `plugins[0].name === 'cto-team'`; `plugins[0].source === './'`; `plugins[0].version === plugin.json.version`.
  - `NOTICE credits both MIT sources`: NOTICE contains `obra/superpowers` and `olsenbrands/fable-foreman` and `MIT`.
- [ ] **Step 2: Run** `node --test tests/` — Expected: FAIL (files missing).
- [ ] **Step 3: Create the files.** `package.json`: `{"name":"cto-team","private":true,"type":"module","scripts":{"test":"node --test tests/"}}`. `.gitignore`: `node_modules/`, `*.log`, `.DS_Store`. LICENSE: MIT, `Copyright (c) 2026 nhattrung0911`. `repository` in plugin.json: `https://github.com/nhattrung0911/cto-team`. NOTICE: one paragraph per source naming which ideas were adapted (from spec §4a and §5).
- [ ] **Step 4: Run** `node --test tests/` — Expected: PASS. Run `claude plugin validate .` — Expected: no errors.
- [ ] **Step 5: Commit** `git add -A && git commit -m "chore: plugin scaffold and manifests"`

### Task 2: Gate workflow script

**Files:**
- Create: `skills/deliver/workflows/gate.js`, `tests/harness.mjs`
- Test: `tests/gate.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces — `args` accepted by `gate.js`:
  `{ gate: "G2", gateBase: "<git sha>", projectRoot: "<abs path>", refs: "<abs path to skills/deliver/references>", tasks: [{ id: "G2-T1", brief: "docs/cto/briefs/G2-T1.md" }] /* 1..3 */, testCmd: "pytest -q", appStart: "<cmd>" | null, critical: true | false, resultPath: "docs/cto/results/G2.json", mode: "gate" | "final" /* default "gate"; "final" requires tasks: [] and runs verifier + fix rounds only, with criteria from every brief listed in finalBriefs */, finalBriefs: ["docs/cto/briefs/G1-T1.md", ...] /* only in final mode */ }`
- Produces — return value:
  `{ gate, verdict: "PASS"|"FAIL"|"BLOCKED", rounds: 0..2, failing: [{ criterion, severity, evidence }], minor: [{ criterion, evidence }], mutation: { checked, caught, restored }, junk: [string], blockers: [string], concerns: [string], resultPath }`
- Produces — schemas (constants in gate.js): `WORKER` `{status: enum["DONE","DONE_WITH_CONCERNS","BLOCKED","FAILED"], files: string[], tests: [{cmd, result}], concerns: string[]}`; `FIXER` = WORKER + `rootCause: string` (required); `VERIFIER` `{verdict: enum["PASS","FAIL"], criteria: [{criterion, pass: boolean, severity: enum["Critical","Important","Minor"], evidence}], mutation: {checked: boolean, caught: boolean|null, restored: boolean|null}, junk: string[], uiUnverified: string[]}`.
- `tests/harness.mjs` exports `async function runGate(args, script)` where `script` is `{ worker(prompt, opts) , verifier(prompt, opts), fixer(prompt, opts) }` returning objects or `null`; it returns `{ result, calls: [{ role, label, prompt, opts }] }`. Role is derived from `opts.label` prefix `worker:`, `verify:`, `fix:`.

- [ ] **Step 1: Write `tests/harness.mjs`.** Read gate.js text; replace `/^export const meta\s*=/m` with `const meta =`; build `new (Object.getPrototypeOf(async function(){}).constructor)('agent','parallel','pipeline','phase','log','args','budget', body)`; `parallel = thunks => Promise.all(thunks.map(t => t().catch(() => null)))`; `phase`/`log` no-ops; `budget = {total:null, spent:()=>0, remaining:()=>Infinity}`.
- [ ] **Step 2: Write the failing tests** in `tests/gate.test.mjs` (default args: 2 tasks, `critical: true`, projectRoot `D:\\AI\\My Project`):
  - `runs one worker per task in parallel with its brief path`: worker calls = 2; each prompt contains its own `brief` path and not the other's; `opts.model === 'sonnet'`; `opts.schema` defined.
  - `rejects more than 3 tasks`: 4 tasks → `runGate` rejects with message containing `max 3`.
  - `pass first time`: verifier returns PASS with all criteria passing → `verdict 'PASS'`, `rounds 0`, no fixer call.
  - `fail then pass uses one fixer`: verifier FAIL (one Important failing) then PASS → `verdict 'PASS'`, `rounds 1`, fixer calls = 1, fixer prompt contains the failing criterion text and `rootCause`.
  - `stops after two fix rounds`: verifier always FAIL → `verdict 'FAIL'`, `rounds 2`, fixer calls = 2, verifier calls = 3, `failing` non-empty.
  - `blocked worker skips verify`: one worker `BLOCKED` with concern `needs API key` → `verdict 'BLOCKED'`, verifier calls = 0, `blockers` contains `needs API key`.
  - `null worker`: one worker returns `null` → verdict not `PASS`; verifier still runs; `concerns` mentions the task id.
  - `null verifier`: verifier returns `null` every time → `verdict 'BLOCKED'`.
  - `script overrides lenient verifier`: verifier says PASS but one criterion `{pass:false, severity:'Critical'}` → treated as FAIL (fixer called). Separate case: PASS with `junk: ['debug.log']` → FAIL.
  - `minor failures do not block`: PASS with one `{pass:false, severity:'Minor'}` → `verdict 'PASS'`, `minor.length === 1`.
  - `unrestored mutation blocks`: verifier PASS with `mutation.restored === false` → `verdict 'BLOCKED'`, no fixer.
  - `verifier is blind`: verifier prompt does not contain any worker `concerns` text or worker `tests[].result` text; contains `gateBase` and `resultPath`.
  - `mutation only when critical`: with `critical: false` verifier prompt contains `Skip the mutation check`; with `true` it contains `Run the mutation check`.
  - `final mode verifies without workers`: `mode: 'final'`, `tasks: []`, `finalBriefs` of 4 paths → worker calls = 0, verifier prompt contains all 4 paths; `mode: 'gate'` with `tasks: []` rejects.
  - `quotes paths with spaces`: every prompt contains `"D:\\AI\\My Project"` with surrounding double quotes.
- [ ] **Step 3: Run** `node --test tests/gate.test.mjs` — Expected: FAIL (gate.js missing).
- [ ] **Step 4: Implement `skills/deliver/workflows/gate.js`.** `meta`: `{name:'cto-team-gate', description:'One cto-team gate: workers, blind verifier, fix rounds', phases:[{title:'Build'},{title:'Verify'},{title:'Fix'}]}`. Throw `Error('cto-team gate: max 3 tasks per gate')` if `args.tasks.length > 3`, or if it is 0 in `gate` mode; in `final` mode skip the Build phase and pass `finalBriefs` to the verifier. Helper `q(p)` wraps a path in double quotes. Worker prompt = "Read and follow the instructions in q(refs/worker-prompt.md). Your task brief is q(projectRoot/brief). Project root: q(projectRoot)." plus testCmd. Worker phase via `parallel`. If any worker status `BLOCKED` → return BLOCKED immediately with their concerns as `blockers`. Verifier prompt references q(refs/verifier-prompt.md), lists only brief paths, `gateBase`, `testCmd`, `appStart`, `resultPath`, and either `Run the mutation check` or `Skip the mutation check`. Decision function `judge(v)`: `null` → BLOCKED; `mutation.restored === false` → BLOCKED; FAIL if `v.verdict !== 'PASS'` or any criterion `!pass && severity !== 'Minor'` or `junk.length > 0`; else PASS. On FAIL and `rounds < 2`: fixer prompt references q(refs/fixer-prompt.md), the brief paths, and the failing criteria with evidence; then re-verify. Return the compact object exactly as in Interfaces.
- [ ] **Step 5: Run** `node --test tests/gate.test.mjs` — Expected: PASS (15 tests).
- [ ] **Step 6: Commit** `git add -A && git commit -m "feat: gate workflow with blind verifier and fix rounds"`

### Task 3: Agent prompts, brief template, test policy

**Files:**
- Create: `skills/deliver/references/{gate-brief.md, worker-prompt.md, verifier-prompt.md, fixer-prompt.md, test-policy.md}`
- Test: `tests/structure.test.mjs` (append)

**Interfaces:**
- Consumes: schema field names from Task 2 (`status`, `files`, `tests`, `concerns`, `rootCause`, `verdict`, `criteria`, `severity`, `evidence`, `mutation.checked|caught|restored`, `junk`, `uiUnverified`).
- Produces: brief sections (in this order, as `## ` headings): `Goal`, `Files you may touch`, `Interfaces`, `Acceptance criteria`, `Break-prone cases`, `Commands`, `Out of scope`. Task 4 and Task 6 rely on these exact headings.

- [ ] **Step 1: Write the failing tests** (append):
  - `brief template has the seven sections in order`: headings above appear in order in `gate-brief.md`.
  - `worker prompt states the contract`: contains every WORKER status literal, `only your brief`, `real tests`, `delete temporary files`, `failing first`.
  - `verifier prompt is blind and evidence-based`: contains `assume the work is broken`, `git diff`, `full test suite`, `mutation`, `restore`, `git status`, `UNVERIFIED`, `Critical`, `Important`, `Minor`, `do not edit source`, `write the full detail to`.
  - `fixer prompt requires root cause`: contains `rootCause`, `root cause`, `evidence`, `no shotgun`.
  - `test policy lists all break-prone categories`: contains each of `boundar`, `empty`, `large`, `Unicode`, `malformed`, `permission`, `IDOR`, `concurren`, `time zone`, `rounding`, `network`, `idempoten`, `XSS`; and the banned list `assert True`, `mock`; and per-type sections `## Web`, `## API`, `## CLI`, `## Data`.
- [ ] **Step 2: Run** `node --test tests/` — Expected: FAIL.
- [ ] **Step 3: Write the five files** from spec §5 and §6. Each prompt ≤ 80 lines. Verifier prompt: light mutation check exactly as spec §6.2 (one one-line break, related test file only, restore, `git diff` clean); UI checks via Playwright MCP if available else project Playwright tests else `UNVERIFIED`; junk check only on files new/changed since `gateBase`; write full table to `resultPath`; return only the schema. Worker prompt: read only the brief; for logic tasks show the new test failing once before implementing; keep tests under the project's test folder; delete scratch files; return ≤10 lines. Test policy: banned-test list, break-prone checklist, per-type "tested means" table (web, API, CLI/script, data).
- [ ] **Step 4: Run** `node --test tests/` — Expected: PASS.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: worker, verifier, fixer prompts and test policy"`

### Task 4: `deliver` skill (CTO playbook)

**Files:**
- Create: `skills/deliver/SKILL.md`
- Test: `tests/structure.test.mjs` (append)

**Interfaces:**
- Consumes: `gate.js` args/return (Task 2), brief headings (Task 3), plan task fields (Task 6 plan template must stay compatible).
- Produces: project files `docs/cto/gates.md` (table columns `Gate | Tasks | Files | Depends on | Critical | Status`, status ∈ `todo|running|pass|fail|blocked`), `docs/cto/briefs/G<n>-T<m>.md`, `docs/cto/results/G<n>.json`, `docs/cto/ledger.md` (one line per gate: `G<n> <verdict> rounds=<r> <sha> — Ruling: ...`), `docs/cto/techdebt.md`, `docs/cto/report.html`; branch `cto/<plan-name>`.

- [ ] **Step 1: Write the failing tests** (append):
  - `deliver frontmatter`: starts with `---`, has `name: deliver`, `description:` containing `deliver` and `plan`; file < 150 lines.
  - `deliver links resolve`: every `references/...` and `workflows/...` path mentioned exists.
  - `deliver states the hard rules`: contains `replaces` + `REQUIRED SUB-SKILL` (override), `max 3`, `disjoint`, `never edit product code`, `SendMessage`, `Ruling:`, stop-list words `scope`, `destructive`, `paid`, `secret`, `cto/` branch, `baseline`, `git stash`, `G0`, `Workflow`, `scriptPath`, `gates.md`, `ledger.md`, `report.html`, `/clear`.
- [ ] **Step 2: Run** `node --test tests/` — Expected: FAIL.
- [ ] **Step 3: Write `skills/deliver/SKILL.md`.** Description triggers only on explicit user request (deliver/execute a plan with the team). Body: (1) setup — git repo/branch/baseline, read plan; (2) gate map with ≤3 disjoint tasks, G0 if no test runner, `critical` flag per gate; (3) per gate: write briefs from `references/gate-brief.md`, record `gate_base`, call Workflow with `scriptPath` = this skill's base directory + `/workflows/gate.js` and the args from Task 2; (4) on result: PASS → ledger + commit; FAIL after 2 rounds → split/re-brief, or tech debt for non-critical only; BLOCKED → resolve or stop list; (5) resume rules from `gates.md`; (6) final whole-app verifier gate (one Workflow call with `mode: "final"`, `tasks: []`, `finalBriefs` = all briefs, `critical: true`); (7) report from `references/report-template.html` in the CEO's language. Keep CTO-side reads to compact results.
- [ ] **Step 4: Run** `node --test tests/` — Expected: PASS. Run `claude plugin validate .` — Expected: no errors.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: deliver skill (CTO playbook)"`

### Task 5: CEO report template

**Files:**
- Create: `skills/deliver/references/report-template.html`
- Test: `tests/structure.test.mjs` (append)

**Interfaces:**
- Consumes: ledger/techdebt contents (filled by CTO).
- Produces: placeholders `{{TITLE}}`, `{{SUMMARY}}`, `{{HOW_TO_TRY}}`, `{{WORKS}}`, `{{STACK_ROWS}}`, `{{MERMAID}}`, `{{GAPS}}`, `{{COST}}`, `{{LANG}}`.

- [ ] **Step 1: Write the failing test** `report template has every placeholder and a mermaid block`: all placeholders present; contains `class="mermaid"`; loads mermaid from `cdn.jsdelivr.net/npm/mermaid@` with an exact version; `<html lang="{{LANG}}">`; has a `prefers-color-scheme: dark` rule.
- [ ] **Step 2: Run** `node --test tests/` — Expected: FAIL.
- [ ] **Step 3: Write the template**: single self-contained file, readable on phone width, sections in spec §8 order, stack as a table `Component | Choice | Why`.
- [ ] **Step 4: Run** `node --test tests/` — Expected: PASS.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: CEO report template"`

### Task 6: `plan` skill (built-in planning)

**Files:**
- Create: `skills/plan/SKILL.md`, `skills/plan/references/{spec-template.md, plan-template.md, plan-review-prompt.md}`
- Test: `tests/structure.test.mjs` (append)

**Interfaces:**
- Consumes: brief headings (Task 3) — each plan task must carry the data for them.
- Produces: plan task block headings `### Task N:` with fields `**Files:**`, `**Interfaces:**`, `**Acceptance criteria:**`, `**Break-prone cases:**`, `**Commands:**`; plan header fields `Goal`, `Architecture`, `Tech Stack`, `Spec`, `Global Constraints`.

- [ ] **Step 1: Write the failing tests** (append):
  - `plan frontmatter`: `name: plan`; description mentions `superpowers` absence fallback; < 150 lines.
  - `plan skill interview rules`: contains `one question`, `play back`, `CTO call`, `default`, `/clear`, `/cto-team:deliver`.
  - `plan template feeds deliver briefs`: plan-template contains every task field above; for each brief heading from Task 3 there is a matching plan field (`Files you may touch`←`Files`, `Interfaces`←`Interfaces`, `Acceptance criteria`←`Acceptance criteria`, `Break-prone cases`←`Break-prone cases`, `Commands`←`Commands`).
  - `spec template sections`: `Intent`, `Goals`, `Non-goals`, `Anti-goals`, `Constraints`, `Decided`, `CTO calls`.
  - `plan review prompt`: contains `guess` and `rank`.
- [ ] **Step 2: Run** `node --test tests/` — Expected: FAIL.
- [ ] **Step 3: Write the four files** per spec §4a. SKILL.md says: if superpowers is installed and the CEO did not ask for this skill, use superpowers brainstorming + writing-plans instead.
- [ ] **Step 4: Run** `node --test tests/` — Expected: PASS. `claude plugin validate .` — no errors.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: built-in plan skill"`

### Task 7: README and install smoke test

**Files:**
- Create: `README.md`
- Test: `tests/structure.test.mjs` (append)

**Interfaces:**
- Consumes: install id `cto-team@cto-team`, commands `/cto-team:plan`, `/cto-team:deliver`.

- [ ] **Step 1: Write the failing test** `README covers install, usage, settings`: contains `/plugin marketplace add nhattrung0911/cto-team`, `/plugin install cto-team@cto-team`, `/cto-team:plan`, `/cto-team:deliver`, `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, `CLAUDE_CODE_SUBAGENT_MODEL`, `Playwright`, `superpowers`.
- [ ] **Step 2: Run** `node --test tests/` — Expected: FAIL.
- [ ] **Step 3: Write README**: what it is (CEO/CTO in 5 lines), install, the flow (plan → `/clear` → deliver), what lands in `docs/cto/`, test policy summary, recommended settings block (values from the owner's machine: compact 500000, subagent sonnet, workflow concurrency 6, Bash output 15000) marked "optional, copy yourself", credits.
- [ ] **Step 4: Run** `node --test tests/` — Expected: PASS. Then local install: `claude plugin marketplace add "D:\AI\Skills\cto-team"` and `claude plugin install cto-team@cto-team`; `claude plugin list` shows `cto-team`; `claude plugin details cto-team@cto-team` prints its token cost (record the number in the commit message).
- [ ] **Step 5: Commit** `git add -A && git commit -m "docs: README; local install verified"`

### Task 8: End-to-end check on a toy project

**Files:**
- Create: `tests/e2e-check.mjs`
- Test: itself is a CLI checker; plus `tests/structure.test.mjs` test `e2e checker rejects an empty folder`.

**Interfaces:**
- Produces: `node tests/e2e-check.mjs "<project path>"` exits 0 and prints `E2E OK` when: branch `cto/*` exists; `docs/cto/gates.md` has no `todo|running` rows; every gate has `results/G<n>.json` with `verdict` `PASS` (or listed in `techdebt.md` as non-critical); `ledger.md` has one line per gate; `report.html` exists and contains no `{{`; `git status --porcelain` is empty; project tests pass when run with the command in `gates.md` header. Otherwise exits 1 listing each failed check.

- [ ] **Step 1: Write the failing test** `e2e checker rejects an empty folder`: run checker on an empty temp dir → exit code 1 and output lists `gates.md`.
- [ ] **Step 2: Run** `node --test tests/` — Expected: FAIL.
- [ ] **Step 3: Implement `tests/e2e-check.mjs`** (Node `child_process.execFileSync` for git; no shell strings).
- [ ] **Step 4: Run** `node --test tests/` — Expected: PASS.
- [ ] **Step 5: Toy delivery (owner runs it).** Create `D:\AI\bench\toy-vnd-split` with a 2-gate plan written with `/cto-team:plan` style (CLI that splits a VND amount among N people with exact-sum rounding, plus CSV input with BOM and bad rows). In a fresh Claude Code session in that folder the owner runs `/cto-team:deliver docs/superpowers/plans/<plan>.md`. Then run `node "D:\AI\Skills\cto-team\tests\e2e-check.mjs" "D:\AI\bench\toy-vnd-split"` — Expected: `E2E OK`. Record session id for cost.
- [ ] **Step 6: Commit** `git add -A && git commit -m "test: e2e checker; toy delivery passed"`

---

Part B (benchmark "Quỹ Nhóm" vs SDD, spec §9) gets its own plan after Part A passes Task 8.
