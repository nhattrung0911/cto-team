# cto-team landing page and README — Spec

Date: 2026-10-18 · CEO: nhattrung0911 · CTO: Claude (cto-team)

## Intent
cto-team is public on GitHub. Vibe coders (people who build with AI agents and are not deep engineers) and the AI
agents they ask to "find a good GitHub skill to level up my coding quality" decide in seconds whether it is worth
installing. They want to know how it differs from what they do today, its best strengths, and real benefits in
numbers. Today the README is long prose and there is no landing page.

## Goals
1. A landing page (`docs/index.html`, deployed to Cloudflare Pages as https://cto-team-skill.pages.dev) with an animated diagram of how one
   delivery runs (CEO → CTO → gate of workers → verifier → fixer → batch review → final check → report), a
   before/after comparison, and charts of the measured numbers below.
2. A rewritten `README.md`: few words, mostly tables and diagrams; before/after vs. normal agent use; strengths
   with numbers; install and usage in three steps; rich, honest keywords so an agent searching GitHub can match and
   summarise it quickly; links to the landing page.
3. Both say the same facts, taken only from the "Facts" section below, with the same numbers.

## Non-goals
- No change to the plugin's behaviour (skills, gate.js, agents, hooks).
- No build tooling, frameworks or new dependencies for the page: one self-contained HTML file.
- No deploying or pushing inside the delivery (the CTO session that launched it deploys after review).

## Anti-goals
- Any number or claim that is not in "Facts", or that overstates one (e.g. saying SDD missed the race bug: we do
  not know that; the race was found by cto-team's own Opus review, which per-gate checks had missed).
- Marketing fluff that hides how it works; a page that breaks on a phone or in dark mode; motion that cannot be
  paused or ignores `prefers-reduced-motion`.

## Users and main flows
1. A vibe coder lands on the README from search → reads the one-line pitch, the before/after table and the numbers
   → copies the two install lines.
2. An AI agent asked to find quality-boosting Claude Code skills reads the README → finds keywords, a summary
   table, requirements and limits within the first screen.
3. A visitor opens the landing page → watches the gate animation (can pause and step) → reads tables and charts →
   copies the install command.

## Constraints
- English. Repo: github.com/nhattrung0911/cto-team. Version 0.4.0. License MIT; credits obra/superpowers (MIT).
- Page: single HTML file, Google Fonts allowed, no other external requests; light and dark theme; works at 375px
  with no horizontal page scroll; text contrast WCAG AA (4.5:1 body, 3:1 large); no body text under 12px.
- README renders on GitHub: Markdown tables, Mermaid (`flowchart`, `xychart-beta`), no HTML-only layout tricks.

## Facts (the only numbers either file may use)
Benchmark: the same 10-task FastAPI app (group expenses: money splits, auth, CSV import, mobile pages), the same
plan, Opus 5.5 main session; 14 hidden tests + 5 extra probes, scored by script.

| Run | Hidden tests | Probes | Weighted tokens | Note |
|---|---|---|---|---|
| superpowers SDD | 14/14 | 5/5 | 4.35M | baseline |
| cto-team v0.1 | 14/14 | 3/5 | 3.60M | a 20-digit amount crashed with HTTP 500 |
| cto-team v0.2 | 14/14 | 5/5 | 4.42M | overflow rules + whole-branch review |
| cto-team v0.3 | 14/14 | 5/5 | 6.40M | Opus review found a real race condition; CTO added a fix gate |

- Weighted tokens = input ×1, cache write ×1.25 (5 min) or ×2 (1 h), cache read ×0.1, output ×5.
- v0.4 is not yet run on that benchmark. A small CLI test run of v0.4: 16 minutes, 1.5M weighted tokens end to end,
  78 tests, its batch review found and fixed 4 real input-handling bugs.
- Agent start context (measured first turn): default subagent 41.7k tokens, cto-team worker 12.0k. Inside real
  gates: 12–14k per agent in v0.4, versus 55–65k per agent in the v0.2/v0.3 runs.
- Audit of one developer's 34 Claude Code sessions: long-lived "team member" agents reused with follow-up messages
  averaged 3.8M weighted tokens and 87 turns each; fresh one-shot agents 0.9M and 42 turns; the longest members
  reached 260–390 turns and 300–570k context.
- Tested on Claude Code 2.1.301. Needs the Workflow tool. Optional: superpowers (planning), Playwright MCP.
- Team size: 1–5 Sonnet workers per gate, chosen by the user (default 3). Opus for CTO, batch review, last fix round.

## Decided (by the CEO)
- Landing page with a motion diagram; README rewritten with fewer words and more tables/charts; strong keywords.
- Build it with `/cto-team:deliver`.

## CTO calls (CEO may override)
- Page lives at `docs/index.html`; it is deployed alone to Cloudflare Pages (project cto-team-skill); the draft `docs/landing-draft.html` is the
  starting point and is deleted once `docs/index.html` exists.
- A small Node test (`tests/docs.test.mjs`) keeps README, page and `plugin.json` consistent (version, key numbers,
  install command, links), so later edits cannot drift.

## Clarifications
- 2026-10-18 — Q: Language? → A: English (public audience); the CEO chats in Vietnamese.

## Open questions
- none
