# Brief G<n>-T<m>: <task name>

<!-- Written by the CTO, read by exactly one worker (and later the verifier and fixer).
     Fill every section. A worker sees nothing but this file: no plan, no chat history.
     Keep it under ~80 lines; link to files instead of pasting them. -->

## Goal
<One or two sentences: what exists when this task is done, in user-visible terms.>

## Files you may touch
- Create: `path/to/new_file.py`
- Modify: `path/to/existing.py`
- Test: `tests/path/test_feature.py`
<Nothing outside this list. Other tasks in this gate own other files.>

## Interfaces
- Consumes (already exists): `function_name(arg: Type) -> Type` in `path/module.py`
- Produces (other tasks rely on it — exact names and types):
  `new_function(arg: Type) -> Type` in `path/module.py`
- Contract operations (if the project has `docs/contract/`): `POST /groups/{id}/expenses` (createExpense) — the
  contract is read-only for you and is the source of truth for routes, fields, types and status codes.

## Global constraints
<Copy the plan's Global Constraints that apply to this task, one line each (e.g. "money is integer VND",
"no new dependencies", "bad input never returns 500").>

## Acceptance criteria
<Numbered, each one checkable by running something. Mark severity: Critical (security, money/numbers,
data loss, auth/permissions, main-path crash), Important (feature broken for a normal user), Minor (polish).>
1. [Critical] <criterion> — check: `<command or observable result>`
2. [Important] <criterion> — check: `<…>`

## Break-prone cases
<Pick from references/test-policy.md the cases that apply to THIS task and state the expected behaviour.
Each needs a real test.>
- Boundary: <input> → <expected>
- Malformed: <input> → <expected>
- Overflow (required for every numeric input): <value past the storage limit> → <clean 4xx / row error, never 500>

## Commands
- Run this task's tests: `<command>`
- Full suite (must stay green): `<command>`
- Start the app (UI/API tasks only): `<command>`

## Out of scope
<What the worker must not do: other features, refactors, dependency upgrades, styling outside the task.>
