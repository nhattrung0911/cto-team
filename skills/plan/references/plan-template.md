# <Product name> Implementation Plan

> For cto-team: execute with `/cto-team:deliver <this file>`.

**Goal:** <One sentence describing what this builds.>

**Architecture:** <2–3 sentences: main components and how data flows.>

**Tech Stack:** <Languages, frameworks, database, test runner — with versions where they matter.>

**Spec:** `<path to the spec>`

## Global Constraints
- <Project-wide requirement, one line each, exact values.>

## Parallel groups
<Tasks that touch disjoint files and do not depend on each other; deliver puts up to the team size (default 3) in one gate.>
- After Task 1: Tasks 2, 3 can run in parallel.

## File map
```
<path>    <one-line responsibility>
```

---

### Task 1: <Component name>

**Files:**
- Create: `exact/path/file.py`
- Modify: `exact/path/existing.py`
- Test: `tests/test_file.py`

**Interfaces:**
- Consumes: `<name(args) -> type>` from Task N (or "nothing").
- Produces: `<name(args) -> type>` in `<file>` — later tasks rely on these exact names.

**Acceptance criteria:**
1. [Critical] <checkable statement> — check: `<command / request / observable result>`
2. [Important] <…>
3. [Minor] <…>

**Break-prone cases:**
- <case> → <expected behaviour> (test: `<test name>`)

**Commands:**
- Task tests: `<command>`
- Full suite: `<command>`
- Start app (if relevant): `<command>`

**Depends on:** <Task numbers or "none">
