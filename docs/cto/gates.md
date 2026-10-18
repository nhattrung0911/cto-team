# Gate map: landing v2 (EN + VI) and README

Plan: docs/plans/2026-10-18-landing-v2.md · Spec: docs/specs/2026-10-18-landing-v2.md

Workers: 3 | Test: npm test | App: python -m http.server 8080 --directory docs | Contract: docs/contract/contract.md

Spec goals: 1 bilingual landing pages + switch + hreflang · 2 page structure (hero, gate diagram, ten feature cards,
3 steps, footer) · 3 READMEs EN + VI · 4 SEO.

| Gate | Tasks | Files | Goals | Depends on | Critical | Status |
|------|-------|-------|-------|------------|----------|--------|
| G1 | T1, T2, T3 | docs/index.html; docs/vi/index.html; docs/landing-draft.html (delete); README.md; README.vi.md | 1, 2, 3, 4 | - | no | pass |
| G2 | T4 | tests/docs.test.mjs | 1, 2, 3, 4 | G1 | no | pass |
| REVIEW-1 | - | whole branch | 1, 2, 3, 4 | G2 | yes | pass |
| FINAL | - | whole branch | 1, 2, 3, 4 | REVIEW-1 | yes | todo |

Coverage: every goal has a gate; every gate serves a goal.
