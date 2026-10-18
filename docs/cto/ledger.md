# Ledger: landing v2

Run unattended (CEO away). Team size 3 per the CEO's prompt. No merge, push, deploy or publish.

Ruling: work on branch cto/2026-10-18-landing-v2 in worktree .claude/worktrees/cto-landing-v2, based on local main 8a194ca (origin/main lacks the spec and plan commits) — isolates this job from the CEO's checkout — cost if wrong: branch must be rebased, no lost work.
Ruling: Workers: 3 — the CEO's prompt set it; G1 has exactly three disjoint tasks — cost if wrong: none.
Ruling: keep the plan's grouping (G1 = T1, T2, T3; G2 = T4), not critical — static content, no money/auth/data writes; one worker writes both pages so EN and VI share one design — cost if wrong: a bigger G1 fix round.
Ruling: write docs/contract/contract.md — G2's tests consume G1's exact strings (feature names, ids, links); one source stops drift — cost if wrong: a small extra file.
Ruling: language switch uses relative links (EN "vi/", VI "../") instead of "/" and "/vi/" — absolute paths break on a local server subpath and file:// checks; on Cloudflare Pages both resolve to the same URLs; hreflang and canonical stay absolute — cost if wrong: two hrefs to change.
Ruling: App for checks = python -m http.server 8080 --directory docs (Python 3.13 present, no project dependency) — pages need a server for the relative switch — cost if wrong: verifier uses file:// instead.
Ruling: README.md must still satisfy tests/structure.test.mjs (it requires /cto-team:plan, /cto-team:deliver, CLAUDE_CODE_AUTO_COMPACT_WINDOW, CLAUDE_CODE_SUBAGENT_MODEL, Playwright, superpowers, ripgrep, "workers per gate", "lean agents", "not a security boundary", 2.1.301, "instruction boundary"); keep a compact "Settings and notes" section even if it passes 10 lines and the file passes ~110 lines — the plan forbids touching other tests and npm test must stay green; these are operating facts, not feature claims — cost if wrong: README a little longer than planned (Minor).
