# cto-team landing page and README — Implementation Plan

**Goal:** A Cloudflare-Pages-ready landing page with a motion diagram and a table-first README, both stating the same
measured facts.
**Spec:** docs/specs/2026-10-18-landing-readme.md (read its "Facts" and "Anti-goals" sections; they are binding)
**Tech:** one self-contained HTML file (inline CSS/JS, Google Fonts only), Markdown + Mermaid, Node test runner.

## Global Constraints
- Use only the numbers and claims in the spec's "Facts" section. Never claim SDD missed the race bug.
- No new dependencies. No change to skills/, agents/, hooks/, tests other than tests/docs.test.mjs.
- English. Version string 0.4.0. Install lines exactly:
  `/plugin marketplace add nhattrung0911/cto-team` and `/plugin install cto-team@cto-team`.
- Test command: `npm test` (runs `node --test "tests/*.test.mjs"`), must stay green.

## Parallel groups
- Group A (parallel, disjoint files): Task 1, Task 2.
- Group B (after A): Task 3.

## File map
- `docs/index.html` — landing page (Task 1). `docs/landing-draft.html` — starting draft, deleted by Task 1.
- `README.md` — rewritten (Task 2).
- `tests/docs.test.mjs` — consistency tests (Task 3).

### Task 1: Landing page `docs/index.html`
**Files:** Create `docs/index.html`; Delete `docs/landing-draft.html`.
**Interfaces:** Produces section ids `pipeline`, `compare`, `numbers`, `verifier`, `start`, `fit` and an element
`#installCmd` holding the two install lines (Task 3 checks them).
**Steps:** Start from `docs/landing-draft.html` (it is a fragment written for a viewer that adds the document
skeleton). Make it a complete document: `<!doctype html>`, `<html lang="en">`, `<head>` with charset, viewport,
title "cto-team for Claude Code", meta description, Open Graph title/description; then the body. Keep its design
direction (blueprint grid, ink and amber signal colors, Bricolage Grotesque / IBM Plex) and its animated pipeline
with Pause/Play and Next step. Fix the draft's problems listed below.
**Acceptance criteria:**
1. [Important] Valid complete document as above; opens from disk in a browser with no console errors — check:
   open via Playwright (or node parse) and read the console.
2. [Important] Every number and claim matches the spec's Facts; the race bug is credited to the Opus batch review,
   with no claim about SDD missing it — check: compare text with the Facts table.
3. [Important] Text contrast meets WCAG AA in light and dark themes (the draft fails it for small mono labels,
   `.tag`, `.band-label`, chart notes and `.node small`); no body text below 12px (`.node small` is ~11px) —
   check: computed colors/sizes in the browser.
4. [Important] At 375px wide: no horizontal page scroll, the pipeline stays readable (nodes wrap), tables scroll
   inside their own container — check: Playwright at 375px, `document.documentElement.scrollWidth <= 375`.
5. [Important] Motion: the pipeline auto-plays, can be paused and stepped by keyboard and mouse, and with
   `prefers-reduced-motion: reduce` shows a static final state with the whole example ledger — check: emulate
   reduced motion in Playwright.
6. [Minor] Bar widths are drawn to scale of the numbers they show (largest value = 100%).
**Break-prone cases:** dark theme via `prefers-color-scheme` and via `data-theme`; clipboard API refused (copy
button falls back to selecting the text); very narrow screens (320px).
**Commands:** full suite `npm test`.
**Out of scope:** README, tests, any plugin file.

### Task 2: Rewrite `README.md`
**Files:** Modify `README.md`.
**Interfaces:** Produces the landing page link `https://cto-team-skill.pages.dev/` and keeps the install
lines and the headings `## Install`, `## Use` (Task 3 checks them).
**Steps:** Rewrite for fast scanning by people and agents:
- First screen: name, one-line pitch with keywords (Claude Code plugin, multi-agent, subagents, Workflow, AI code
  review, test quality, TDD, vibe coding, Opus, Sonnet, token cost), a 4–6 row "at a glance" table (what it is,
  who it is for, what it changes, cost, requirements), install lines, link to the landing page.
- Before/after table: "typical vibe-coding session" vs "with cto-team" (who checks the work, what counts as done,
  how much plan an agent sees, agent lifetime, fake tests, bad input, API drift, context reset, end result).
- Mermaid `flowchart` of one delivery (CEO → CTO → gate workers → verifier → fixer loop → batch review → final
  check + user tester → report).
- Numbers: the benchmark table from Facts, one Mermaid `xychart-beta` bar chart of weighted tokens, the agent
  start-context comparison, the per-agent audit numbers; state the weighting formula and that v0.4 is not yet
  benchmarked.
- What the verifier checks (table). When to use / not use. Requirements. FAQ (3–5 short Q&A an agent could quote:
  "Does it replace superpowers?", "How much does it cost?", "Does it work without Playwright?", "Can I pick the
  number of workers?").
- Keep, shorter: what lands in the project (`docs/cto/…`), optional recommended settings, credits (obra/superpowers
  MIT, olsenbrands/fable-foreman), license.
Under ~170 lines; prose sentences short.
**Acceptance criteria:**
1. [Important] Every number and claim matches the spec's Facts; no claim that SDD missed the race bug.
2. [Important] Renders on GitHub: tables are valid Markdown, Mermaid blocks use only `flowchart` and
   `xychart-beta` syntax that parses (check with the Mermaid syntax you know; no HTML tables).
3. [Important] Contains the install lines exactly, `## Install`, `## Use`, the landing page link, the before/after
   table, the benchmark table, and credits for obra/superpowers.
4. [Minor] Under ~170 lines.
**Break-prone cases:** Mermaid labels with parentheses or slashes must be quoted; table pipes inside code must be
escaped.
**Commands:** full suite `npm test`.
**Out of scope:** the landing page, tests, any plugin file.

### Task 3: Consistency tests `tests/docs.test.mjs`
**Files:** Create `tests/docs.test.mjs`.
**Interfaces:** Consumes Task 1 ids and `#installCmd`, Task 2 headings and link, `.claude-plugin/plugin.json`.
**Steps:** Node `node:test` + `node:assert/strict`, reading files with `fs` (no new dependencies). Tests:
1. README and `docs/index.html` both contain both install lines exactly.
2. The version in `plugin.json` appears in README and in `docs/index.html`.
3. The benchmark numbers `4.35M`, `3.60M`, `4.42M`, `6.40M`, `41.7k`, `12.0k` appear in both files.
4. Neither file says SDD "missed" anything (regex on "SDD" within the same sentence as "miss").
5. `docs/index.html` has the six section ids, a `<title>`, `lang="en"`, and a `prefers-reduced-motion` rule;
   `docs/landing-draft.html` no longer exists.
6. README contains `## Install`, `## Use`, the landing page URL, and at least one ```mermaid block.
Each test must fail if its file is broken in that way (name the one-line change that would make it fail).
**Acceptance criteria:**
1. [Important] The six tests exist, pass, and each fails when its condition is broken — check: break one value in
   a temp copy or reason from the assertion.
2. [Important] `npm test` is green.
**Commands:** `node --test tests/docs.test.mjs`; full suite `npm test`.
**Out of scope:** changing README or the page (report a mismatch as a concern instead).

## Review Focus
- Numbers drifting between README, page and Facts.
- Dark-mode contrast and 375px layout on the page.
- Mermaid syntax that GitHub fails to render.
