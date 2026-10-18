# cto-team — Design

Date: 2026-10-18 · Owner: nhattrung0911 · Status: draft for approval

## 1. Intent

Vibe coders are usually not technical. They act like a **CEO**: they know what they want, not how to build it. `cto-team` makes the main Claude Code session (Opus 5.5) act as their **CTO**, running a small team of **Sonnet 5.5 workers**, so an idea becomes a working project with consistent quality and controlled token cost.

Priority order (user's words): **result quality first, cost second.**

Why now: an audit of the owner's 34 sessions / 331 subagents (Sep–Oct 2026) showed:

- Long-lived "member" agents continued via `SendMessage` grew to ~960k context; 17 of them were 51% of all subagent cost. A member/gate agent cost 3.8M weighted tokens on average vs 0.9M for a fresh one-shot implementer and 0.5M for a reviewer.
- With superpowers `subagent-driven-development` (SDD), subagents were cheap but the **main Opus session** cost 15–49M per session because it did hands-on work itself (130–730 Bash calls, 60–180 Edits, Playwright screenshots in main context) and received every per-task report.
- No style showed fewer user bug complaints (~14–15% of user messages in every style), so quality must be proven, not assumed (see §9).

## 2. Goals, non-goals, anti-goals

Goals
- CTO plans with the CEO once (using superpowers), then decides all technical matters alone.
- Delivery gate by gate. Workers never see the full plan, only their task brief.
- Every gate passes an independent, evidence-based verification before the next gate starts.
- Final plain-language report for the CEO: results, how to try it, tech stack with reasons, architecture diagram, known gaps/tech debt.
- Main-session context stays small: per gate it receives one compact structured result.

Non-goals
- Re-implementing superpowers in full. If superpowers is installed, planning uses it (`brainstorming` → spec, `writing-plans` → plan) and `cto-team` consumes the plan file. If it is not installed, `cto-team` ships a compact built-in planning path (§4a) so the plugin is complete on its own.
- Codex / other harnesses (later, separate decision).
- A library of personas. Roles are only: CTO, worker, verifier, fixer.

Anti-goals (failure even if it "works")
- Long-lived workers resumed with `SendMessage`.
- CTO editing product code, running long test/debug loops, or taking screenshots in its own context.
- Tautological tests (`assert True`, `expect(1).toBe(1)`), tests that only test mocks, tests that can never fail.
- A gate marked PASS on a worker's self-report without fresh evidence.
- Junk left in the repo (temp scripts, screenshots, logs, scratch DBs, debug prints).
- Asking the CEO technical questions during delivery.

## 3. Constraints

- Claude Code only.
- Workflow tool is used per gate. Workflows require explicit opt-in; a skill **the user invokes** that tells Claude to call Workflow counts. Therefore delivery starts from a user-invoked command (`/cto-team:deliver <plan-path>` or the user saying "deliver this plan with the team"), never auto-triggered.
- Workflow scripts are plain JS, no filesystem access, no `Date.now()`; agents inside do file work.
- Plugin must not change the installer's machine settings. Recommended settings go in README only.
- License MIT. Attribution in `NOTICE` for ideas adapted from obra/superpowers (MIT) and olsenbrands/fable-foreman (MIT).
- Skill text in English. CEO-facing output (report, rare questions) in the language the CEO uses in chat.

## 4. Lifecycle

```
CEO idea
  │  superpowers:brainstorming  (CTO + CEO, once)  → docs/superpowers/specs/<date>-<topic>-design.md
  │  superpowers:writing-plans                       → docs/superpowers/plans/<date>-<topic>.md
  │  /clear  (plan is on disk; delivery starts with a small context)
  ▼
/cto-team:deliver <plan>
  1. Gate map      CTO groups plan tasks into gates           → docs/cto/gates.md
  2. Per gate      Workflow: ≤3 workers → verifier → ≤2 fix rounds → compact result
  3. Gate exit     CTO records ruling, commits                → docs/cto/ledger.md
  4. Final check   whole-app verifier (full suite + E2E)
  5. Report        plain-language report with diagram         → docs/cto/report.html
```

### 4a. Built-in planning and borrowed practices (owner request: work well without superpowers)

`/cto-team:plan` — used when superpowers is absent (or the CEO asks for it). Compact adaptation of superpowers `brainstorming` + `writing-plans` (MIT, attributed in NOTICE):
- CEO interview: one question per message, concrete-moment questions, play back understanding in short chunks, CTO proposes sensible defaults for every technical choice in plain words and logs them as CTO calls.
- Writes the spec (intent, goals, non-goals, anti-goals, constraints, decided vs CTO calls) and the plan in the same task format `deliver` reads: header (goal, architecture, tech stack, global constraints), file map, tasks with files, interfaces, acceptance criteria, break-prone cases, test commands. Tasks sized as independently testable deliverables, not one-line steps.
- One fresh reviewer pass on the plan ("what would a builder have to guess?") before the CEO approves it.
- Ends with: "/clear, then /cto-team:deliver <plan>".

Practices borrowed into `deliver` and its prompts (inlined, not called, so they work without superpowers):
- From `verification-before-completion`: no completion claim without fresh evidence; agent reports are not evidence.
- From `subagent-driven-development`: never pass session history to workers, construct exactly the context they need; "rulings, not stalls" (decide and log instead of pausing); ledger file as recovery after compaction; stop list for destructive/external actions; implementer status contract.
- From `dispatching-parallel-agents`: one agent per independent domain; brief = scope, goal, constraints, expected output.
- From `test-driven-development`: tests written to fail first for logic tasks (worker shows the failing run once), kept minimal.
- From `systematic-debugging`: fixer must state root cause with evidence before changing code; no shotgun fixes.
- From `requesting-code-review`: verifier severity triage Critical / Important / Minor (Critical and Important block the gate).

Override rule: plans from `writing-plans` start with "REQUIRED SUB-SKILL: subagent-driven-development or executing-plans". When `cto-team:deliver` is invoked, it replaces that instruction; the skill says so explicitly.

## 5. Roles and rules

**CTO (main session, Opus)**
- Reads: plan, `gates.md`, `ledger.md`, gate results. Does not read worker transcripts.
- Writes: gate briefs, `gates.md`, `ledger.md`, `techdebt.md`, report. Runs `git` and quick sanity commands only.
- Never edits product code or tests; never runs browsers. If something needs hands-on work, it becomes a worker or fixer task.
- Decides alone and logs `Ruling: <decision> — <reason>` in the ledger.
- Contacts the CEO only for the stop list: scope change (feature infeasible / plan contradicts spec), destructive or irreversible action, paid external service, secrets/credentials needed, legal/privacy risk.

**Worker (Sonnet, fresh per task, one-shot)**
- Input: one task brief file only (goal, files it may touch, interfaces, acceptance criteria, applicable break-prone cases, test commands). Never the whole plan, never session history.
- Writes code + real tests for its task; runs them; cleans its own temp files.
- Returns a fixed schema: `status: DONE | DONE_WITH_CONCERNS | BLOCKED | FAILED`, files changed, test commands + results, concerns (≤10 lines total).

**Verifier (Sonnet, fresh per gate, read-only on source)**
- "Blind": gets only the gate's acceptance criteria, the task briefs' criteria, and the diff range. Not worker reasoning, not worker reports' claims.
- Assumes the work is broken until evidence says otherwise. Runs the **full** test suite (regression across all previous gates), build, lint/typecheck, and for UI gates browser checks via Playwright MCP.
- Applies the test policy (§6), including the mutation check.
- Returns per-criterion table `criterion | PASS/FAIL | exact evidence`, mutation results, junk list, verdict.

**Fixer (Sonnet, fresh per round)**
- Gets: original brief + verifier findings only. Max 2 fix rounds per gate, each followed by a fresh verifier.
- After 2 failed rounds the CTO must: split the task, re-brief, or (only for non-critical items) log to `techdebt.md`. **Critical items never go to tech debt:** security, data loss/corruption, money/number correctness, auth/permissions, crash on main path. Those are fixed or escalated to the CEO.

**Concurrency and conflicts**
- Max 3 workers per gate. Tasks in one gate must have disjoint file sets (declared in `gates.md`). If they overlap, the CTO puts them in different gates. No worktrees by default.

## 6. Test policy (owner's rules, enforced by the verifier)

1. **No tautological tests.** Each test must be able to fail. Banned: constant assertions, asserting a mock returns what it was told, snapshot-only tests for logic, tests with no assertion.
2. **Light mutation check (keep it cheap).** Only on gates that touch critical logic (money/numbers, auth/permissions, data writes). The verifier breaks **one** key behaviour with a one-line change (flip a condition, off-by-one, drop a permission check), runs only the related test file, confirms it fails, then restores and confirms `git diff` is clean. If the test still passes, the gate fails. UI-only, config and docs gates skip this. Tautology check is a quick read of the new tests, not a tool.
3. **Break-prone cases are mandatory where they apply.** Each brief lists which apply; the verifier checks they are covered: boundaries / off-by-one, empty and missing input, very large input, Unicode and Vietnamese diacritics, malformed input, auth and permissions (including IDOR), concurrent modification, time zones and date boundaries, rounding and money, external failure (network/DB down, timeouts), idempotency/double submit, injection/XSS.
4. **Keep real tests, delete temporary things.** Real tests live in the project's test folder and are re-run every gate. Before a gate can pass, `git status` must show no junk: ad-hoc scripts, screenshots, logs, scratch DBs, coverage output not gitignored, debug prints, commented-out code blocks.
5. **Evidence over claims.** A worker's "tests pass" is never accepted; only the verifier's fresh run counts.

## 7. Files

In the plugin repo (`D:\AI\Skills\cto-team`, GitHub `nhattrung0911/cto-team`):

```
.claude-plugin/plugin.json
.claude-plugin/marketplace.json
skills/deliver/SKILL.md                 CTO playbook (target < 150 lines)
skills/deliver/references/
    gate-brief.md                       brief template
    worker-prompt.md
    verifier-prompt.md                  blind verifier + mutation check
    fixer-prompt.md
    test-policy.md                      §6 + break-prone checklist per project type (web, API, CLI/script, data)
    report-template.html                plain-language report, Mermaid diagram
skills/deliver/workflows/gate.js        one gate: workers → verifier → fix loop, schema results
skills/plan/SKILL.md                    built-in CEO interview + spec + plan (used when superpowers is absent)
skills/plan/references/                 spec template, plan template, plan-review prompt
README.md                               install, usage, recommended settings
LICENSE (MIT), NOTICE (attributions)
docs/superpowers/specs/, docs/superpowers/plans/
```

In each user project (created by the skill):

```
docs/cto/gates.md        gate map: tasks, file sets, dependencies, status
docs/cto/briefs/G<n>-T<m>.md
docs/cto/results/G<n>.json
docs/cto/ledger.md       one line per gate + rulings
docs/cto/techdebt.md
docs/cto/report.html
```

Gate result returned to the CTO (compact): `{gate, verdict: PASS|FAIL|BLOCKED, rounds, failing_criteria[], mutation:{checked, caught}, junk[], techdebt[], next_hint}`. Full detail stays in `results/G<n>.json`.

## 8. Final report (CEO-facing)

Sections: what was built and how to try it (commands/URLs), what works (mapped to the CEO's goals), tech stack (each item + one-line "why"), architecture diagram (Mermaid: components, data flow, external services), known gaps and tech debt with impact in plain words, cost summary (gates, rounds). Written in the CEO's chat language, no jargon without a one-line explanation.

## 9. Proof: benchmark against SDD

Goal: show `cto-team` is at least as good as SDD on quality, and cheaper. Quality decides; cost is the tie-breaker.

App: **"Quỹ Nhóm"**, a small group-expense web app with deliberate traps:
auth (password hashing, session expiry) · groups and members, IDOR across groups · expenses in VND, equal/custom split, rounding (100,000 / 3 sums exactly) · balances and minimal settle-up · CSV import (bad rows, BOM, decimal comma, Vietnamese text) · accent-insensitive search ("ha noi" finds "Hà Nội") · XSS in descriptions · concurrent edit of one expense (no lost update) · monthly report at Asia/Ho_Chi_Minh day boundaries · removing a member with non-zero balance is blocked · mobile layout, empty/loading/error states.

Stack fixed for both runs (my call): Python FastAPI + SQLite + server-rendered HTML with small JS, pytest. The spec includes an exact HTTP API contract so external tests can score both runs.

Protocol
- One spec and one plan, written with superpowers, shared by both runs.
- Run A: SDD. Run B: `cto-team`. Each in its own folder (`D:\AI\bench\quy-nhom-sdd`, `D:\AI\bench\quy-nhom-cto`), each in a fresh session, same model settings.
- **Hidden test suite, kept small:** one pytest API test per trap (~12 tests) plus one Playwright smoke test (login → add expense → see balance, on a phone-size viewport). Written before the runs, stored outside both run folders (`D:\AI\bench\_hidden`), never visible to either run. Scoring is one script run, no agents.

Scoring, in order
1. Hidden tests pass rate, and bugs by category (security, money, data, UX).
2. Own tests quality: count of tautological tests (quick read) and 3 fixed one-line mutations (does their suite catch each).
3. Junk files left, CEO interruptions.
4. Cost: weighted tokens main vs subagents (same analyzer as the audit), wall-clock time.

Success: `cto-team` hidden-test pass rate ≥ SDD, no critical bug that SDD did not have, zero junk, and total weighted cost ≤ 60% of SDD. If quality is lower, fix the skill before publishing; cost wins do not compensate.

## 10. Mechanics (settled after builder check)

- **Workflow API.** `gate.js` uses `agent(prompt, {model:'sonnet', schema, phase, label})`, `parallel()` for ≤3 workers, then sequential verifier/fixer calls; `schema` makes each agent return validated JSON. Agents do all file I/O: prompts pass file paths (`docs/cto/briefs/G2-T1.md`), never file contents. The verifier gets the diff range as `git diff <gate_base>..HEAD` plus working tree, where `gate_base` is passed in `args`. The workflow returns the compact gate result; workers' transcripts never reach the CTO.
- **Opt-in scope.** One user invocation of `/cto-team:deliver` covers every gate Workflow of that delivery run. No per-gate approval.
- **Deliverables split.** Part A: the plugin (§7). Part B: the benchmark (§9) in a separate folder `D:\AI\bench` with `_hidden/` tests, `score.py`, and `cost.py` (the audit analyzer, already written, moved into the bench). Publishing to GitHub is gated on Part B results.
- **UI checks.** The brief carries the app start command from the plan. The verifier starts the app, checks with Playwright MCP if available, else with the project's own Playwright tests; if neither works, UI criteria are reported `UNVERIFIED`, the gate is BLOCKED for critical UI paths (login, main flow) and noted in the report otherwise. README lists Playwright MCP as recommended, not required.
- **Git.** At start: require a git repo (init if none), create branch `cto/<plan-name>`. If the tree is dirty, commit the existing state as `chore: baseline before cto-team` (not destructive). Each gate records `gate_base`; junk check looks only at files new or changed since `gate_base`. CTO commits once per passed gate.
- **Resume.** `gates.md` holds status per gate: `todo | running | pass | fail | blocked`. On re-entry the CTO reads `gates.md` + `ledger.md`; a `running` gate restarts with fresh agents on top of `gate_base` (uncommitted gate changes are kept in a named `git stash`, not deleted).
- **Plan input.** superpowers is recommended, not required. Any markdown plan with tasks works; if tasks lack file lists or criteria, the CTO fills them into briefs.
- **No test command.** If the project has no test runner, the CTO adds gate G0 "test harness" before feature gates. Never asks the CEO.

## 11. Decided vs left to the builder

Decided (owner): CEO/CTO split; Opus CTO + max 3 Sonnet workers; plan with superpowers, deliver with this skill; gate-by-gate with independent verification; CTO decides alone; final report with stack + architecture diagram; English skill; Claude only for now; keep real tests, delete temp files; no tautological tests; test break-prone cases; quality before cost; publish on GitHub as `nhattrung0911/cto-team`.

My calls (owner may override): Workflow per gate; blind verifier + mutation check; max 2 fix rounds; critical items never tech debt; report in CEO's language as HTML + Mermaid; plugin + marketplace packaging; MIT + NOTICE; benchmark app, stack and protocol in §9; success thresholds in §9; everything in §10 (branch per delivery, baseline commit, resume via stash, G0 test harness, UI `UNVERIFIED` rule, publish gated on benchmark). Light mutation check and small hidden suite per owner's request to keep test-of-tests cheap.

Left to the builder: exact prompt wording, JSON schema details, how `gates.md` is formatted, how the skill detects the test command for a project.
