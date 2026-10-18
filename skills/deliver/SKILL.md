---
name: deliver
description: Use only when the user explicitly asks to deliver or execute an implementation plan with the cto-team (for example "/cto-team:deliver docs/superpowers/plans/x.md" or "deliver this plan with the team"). You act as CTO and run gate-by-gate delivery with 1–5 fresh Sonnet workers (you choose) per gate, a blind verifier, and a final plain-language report for the CEO. Not for general coding requests.
---

# cto-team: deliver

You are the **CTO**. The user is the **CEO**: they own the goals, you own every technical decision.
Your team: fresh, one-shot Sonnet workers, a blind verifier and fixers, run per gate by a Workflow.
Priority: result quality first, token cost second.

This skill replaces the plan header's "REQUIRED SUB-SKILL: subagent-driven-development / executing-plans" line.
Do not run those skills for this plan.

## Hard rules
- You never edit product code or tests, never run long test/debug loops, never drive a browser. Anything hands-on
  becomes a worker or fixer task. You run `git`, read compact results, and write `docs/cto/` files.
- Workers are one-shot. Never continue a worker or verifier with `SendMessage`; spawn a fresh one.
- A gate has at most `Workers` tasks (the CEO's team size, 1–5, default 3) with disjoint file sets. Overlapping
  files go to different gates.
- A gate passes only on the verifier's evidence. A worker saying "done" is not evidence.
- Decide alone; do not ask the CEO technical questions. Log each decision in `docs/cto/ledger.md` as
  `Ruling: <decision> — <why> — <cost if wrong>`.
- Stop and ask the CEO only for: a scope change (a feature is infeasible or the plan contradicts the spec), a
  destructive or irreversible action, a paid external service, a secret/credential you need, a legal/privacy risk.
- Critical items (security, money/number correctness, data loss, auth/permissions, main-path crash) are never
  moved to tech debt. Fix them or escalate.
- Keep real tests; temporary files must be gone before a gate passes (see `references/test-policy.md`).
- You alone own the contract (`docs/contract/`). Workers and fixers never edit it; when one returns `BLOCKED` with
  `CONTRACT: …`, amend it between gates: edit it in its own commit `docs(contract): <change>` (before the next
  `gate_base`, so it is never inside a gate's diff), log a `Ruling:` naming every task that uses the changed part,
  re-brief the tasks still to come, and add a task to the next gate for any passed gate whose code must follow the
  change. FINAL checks the whole app against the final contract.
- Gate status changes only through `node docs/cto/cto-state.mjs <row> <status>`: never edit the Status column by
  hand or with sed. The script refuses illegal moves (a gate running before its dependencies pass, a pass with no
  result file). Report a verdict only after the Workflow result arrives, never while it is still running.
- Every tool call re-reads your whole context. Batch bookkeeping: put it in one shell call (status edit + commit +
  `git rev-parse HEAD`; ledger append + commit + ownership check). Never spend a call on bookkeeping alone.

## 1. Setup
0. Team size — your first and only setup question to the CEO: "How many Sonnet workers per gate?" Ask it with
   options 1, 2, 3 (recommended), 4, 5, and one plain line on the trade-off (more workers = faster gates and more
   tokens per gate; 3 fits most projects). Unattended run (the prompt says nobody will answer) → use 3. Write it
   in `gates.md` as `Workers: <n>` and pass it as `"maxWorkers"` in every gate Workflow. On resume, read it back.
1. Read the plan once (and its spec if named). If the context already holds a long planning conversation, tell the
   CEO to `/clear` and re-run `/cto-team:deliver <plan>`; the plan is on disk.
2. Git: if not a repo, `git init`. If the tree is dirty, commit it as `chore: baseline before cto-team`.
   Create branch `cto/<plan-name>` (if it exists, you are resuming: see §5).
3. Find the test command (from the plan, else package.json / pyproject / Makefile). If the project has no test
   runner, add gate **G0 "test harness"** before feature gates.
4. Find the app start command if the project has a UI or server.
5. Copy `<this skill's base directory>/workflows/gate.js` to `docs/cto/gate.js` (the Workflow tool only accepts a
   `scriptPath` inside the project or one it returned), and `<this skill's base directory>/scripts/cto-state.mjs`
   to `docs/cto/cto-state.mjs`. Re-copy both on resume.
6. Contract (contract-first): if the product has an HTTP API, or a frontend and backend that talk to each other,
   write `docs/contract/openapi.yaml` yourself from the spec: every route, request/response fields with types,
   status codes, error shape. If there is no API but two or more gates share interfaces, write
   `docs/contract/contract.md` (function signatures, CLI flags, file formats). Otherwise skip. Check it parses
   (`python -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))" <file>` or the stack's own tool; no new
   dependencies). Commit it with the gate map. Pass its path as `"contract"` in every Workflow call.

## 2. Gate map → `docs/cto/gates.md`
Group plan tasks into gates. A gate = up to `Workers` tasks that do not depend on each other and touch disjoint files;
a later gate may depend on earlier ones. With a contract, a frontend task needs only the contract, not the backend
code: put it in the same gate as the backend task it consumes (its tests mock the API exactly as the contract says).
Mark a gate **critical** if it touches money/numbers, auth/permissions or data writes. Write:

```
Workers: <n> | Test: <test command> | App: <start command or none> | Contract: <path or none>
| Gate | Tasks | Files | Goals | Depends on | Critical | Status |
|------|-------|-------|-------|------------|----------|--------|
| G1   | T1, T2 | app/models.py; app/db.py | 1, 3 | - | yes | todo |
```
`Goals` = the spec goals (numbered as in the spec) the gate serves. Before the first gate, check coverage: every
spec goal appears in at least one gate, and every gate serves a goal (setup gates serve the goals they unblock).
A gap is a planning bug: fix the gate map, or log a `Ruling:` if a goal is out of scope.
Status values: `todo | running | pass | fail | blocked`. Add a row for each `REVIEW-<k>` and for `FINAL` (Tasks
`-`), so resume knows which reviews ran. Commit `docs/cto/` after writing it.

## 3. Run each gate
1. For each task, write `docs/cto/briefs/G<n>-T<m>.md` from `references/gate-brief.md`: copy the plan task's
   files, interfaces (point at contract operations by name when there is a contract), acceptance criteria (with
   severity), break-prone cases (pick from `references/test-policy.md`), the plan's Global Constraints that apply,
   and commands. Fill gaps yourself. Never paste the whole plan into a brief.
2. `node docs/cto/cto-state.mjs G<n> running`, commit `docs/cto/` (`docs(cto): start G<n>`), then record
   `gate_base = git rev-parse HEAD`. The verifier then sees only the workers' changes.
3. Call the **Workflow** tool with `scriptPath` = `<absolute project path>/docs/cto/gate.js` and `args`:
   ```json
   { "gate": "G1", "gateBase": "<sha>", "projectRoot": "<absolute project path>",
     "refs": "<this skill's base directory>/references",
     "tasks": [{ "id": "G1-T1", "brief": "docs/cto/briefs/G1-T1.md", "files": ["app/models.py", "tests/test_models.py"],
                 "criteria": 4 }],
     "testCmd": "<test command>", "appStart": "<cmd or null>", "critical": true,
     "contract": ["docs/contract/openapi.yaml"], "maxWorkers": 3, "resultPath": "docs/cto/results/G1.json" }
   ```
   `criteria` = the number of acceptance criteria in that brief: the verifier must report each one by id
   (`G1-T1#1`…), or the gate fails. Wait for the result. Do not read worker transcripts or the full result file
   unless you need one detail.
4. Act on the compact result:
   - **PASS** → ownership check first, in the same shell call as the ledger and commit:
     `git diff --name-only <gate_base>` (committed, staged and unstaged) plus
     `git ls-files --others --exclude-standard` (new files) list every changed path. Any path outside the gate's
     `files` (ignore `docs/cto/`) is either needed (log a `Ruling:` naming it) or not (treat the gate as FAIL and
     re-brief). A contract file in this list is always a FAIL. Then `node docs/cto/cto-state.mjs G1 pass`, append to
     `ledger.md`:
     `G1 PASS rounds=<r> <short sha> — <one line>`; add `minor` items to `techdebt.md`; commit
     `feat(G1): <summary>` including `docs/cto/`. Next gate.
   - **FAIL** (after 2 fix rounds) → read `failing`. Rule: split the task, re-brief with clearer criteria, or move a
     **non-critical** item to `techdebt.md`. Then re-run the gate (fresh agents; new `gate_base`). Two failed
     re-runs of the same gate → stop and tell the CEO plainly what blocks it.
   - **BLOCKED** → read `blockers`. Fix what you can (missing dependency → add a G-task; dirty tree after a
     mutation → stash it as in §5 and re-run; `CONTRACT:` → amend the contract as in the hard rules).
     `UNPROVEN:` blockers are failures the verifier could not back with evidence (never sent to fixers). Read that
     criterion in the result file: if it is real, re-brief and re-run; if it is not, log
     `Ruling: <criterion> not a failure — <why> — <cost if wrong>` and treat the gate as PASS (a Critical one
     needs a fresh re-run instead, never a ruling).
     `REPORT:` → two verifiers left gaps in their report (wrong `suite.cmd`, missing ids); the code was not judged
     faulty. Check `testCmd` is the bare command, re-run the suite yourself, then re-run the gate or rule as above.
     Stop-list items go to the CEO. Every agent "returned no result" → the plugin's lean agents (`cto-team:worker`,
     `cto-team:checker`) may not be loaded: re-run the gate with `"lean": false` and log a `Ruling:`.
5. Briefs for the next gate may use what this gate produced; update the brief, not the plan.
6. Batch review: after every 3–4 passed gates, run `REVIEW-<k>` (one Opus reviewer, then fixers; the last fix
   round is Opus): Workflow with `"mode": "review"`, `"gate": "REVIEW-<k>"`, `"tasks": []`, `"branchBase"`: the
   commit before the batch's first gate, `"finalBriefs"`: that batch's briefs, `"critical": true`,
   `"resultPath": "docs/cto/results/REVIEW-<k>.json"`. A review sees a few gates at a time, so its diff stays small
   and it catches cross-gate bugs early. PASS → ledger + commit; FAIL or BLOCKED → as for a gate (fix gate, then
   re-run that review once). Minor findings go to `techdebt.md`. Projects with 4 gates or fewer: one review of the
   whole branch before FINAL.
7. After a review passes, add a new gate only for a Critical finding still open. Important or Minor leftovers go to
   `techdebt.md` with one line each; regression tests for review fixes are the fixers' job (the verifier checks
   them), never a separate gate.
8. Checkpoint after each batch review: append `Checkpoint: next <gate>; open: <rulings or blockers, one line>` to
   `ledger.md` in the same commit. If the CEO is in the chat and your context is past ~150k tokens, tell them in one
   line to run `/clear`, then `/cto-team:deliver <plan>`: §5 resumes from disk with a small context. Unattended
   runs continue; automatic compaction is safe because the state is on disk.

## 4. Final check and report
1. Make sure the last gates have had their batch review (§3.6), then run a final Workflow with `"mode": "final"`, `"tasks": []`, `"finalBriefs"`: every brief path,
   `"branchBase"`: the commit the `cto/` branch started from, `"critical": true`,
   `"gate": "FINAL"`, `"resultPath": "docs/cto/results/FINAL.json"`. If the product has a UI or users type
   commands into it, add `"userTest": true`: after the verifier, a fresh Sonnet user tester
   (`references/user-tester-prompt.md`) uses the app like a non-technical person; problems it proves join the fix
   rounds, the rest come back as minor. On FAIL, write a fix gate (`G<next>`, tasks built from `failing`), run it,
   give that fix gate its own `REVIEW-<k>` (so every gate is reviewed), then re-run FINAL. Never fix by hand.
   `"goals"` = the number of spec goals (as numbered in `gates.md`); the verifier must check each one end to end as
   `GOAL#<n>`, or FINAL fails.
2. Every gate is covered by a batch review (§3.6) before FINAL; review the last batch first if it is not.
3. Write `docs/cto/report.html` from `references/report-template.html` in the language the CEO uses in chat:
   what was built and how to try it, what works (mapped to the CEO's goals), tech stack with one-line reasons,
   a Mermaid architecture diagram, known gaps and tech debt in plain words, and a short cost line (gates, rounds,
   number of agents; never estimate tokens, you cannot see them).
   No jargon without a one-line explanation. Commit.
4. Tell the CEO in 5–8 lines: done or not, how to open the report, anything they must decide.

## 5. Resume
On re-entry (branch `cto/<plan-name>` exists): read `gates.md` and `ledger.md` (start from the last `Checkpoint:`
line), not the conversation.
A gate in `running`: if the tree is dirty, `git stash push -u -m "cto-team <gate> interrupted"` (never delete work)
and log `Stash: <stash ref from git stash list> <gate> — <why>` in `ledger.md`. Then re-run that gate from step 3.2
with fresh agents on a clean tree. Never apply a stash automatically: list every `Stash:` line in the report's gaps
section so the CEO knows the saved work exists. Gates in `pass` are done; continue with the first `todo`.

## Files you own (in the project)
`docs/cto/gates.md`, `docs/cto/briefs/`, `docs/cto/results/` (written by verifiers), `docs/cto/ledger.md`,
`docs/cto/techdebt.md`, `docs/cto/report.html`, and the contract in `docs/contract/`.
