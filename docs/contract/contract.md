# Contract: landing v2 pages and READMEs

Owner: the CTO. Workers and fixers read it, never edit it. G1 produces these shapes; G2's tests check them.

## Shared constants
- Install lines, exactly, in this order, each on its own line:
  - `/plugin marketplace add nhattrung0911/cto-team`
  - `/plugin install cto-team@cto-team`
- Version: the `version` field of `.claude-plugin/plugin.json` (now `0.4.0`), written as `0.4.0` or `v0.4.0`.
- Repo: `https://github.com/nhattrung0911/cto-team`. License MIT. Credit: obra/superpowers
  (`https://github.com/obra/superpowers`).
- Landing URLs: EN `https://cto-team-skill.pages.dev/`, VI `https://cto-team-skill.pages.dev/vi/`.

## Feature names (exact strings, this order)
| # | English | Vietnamese |
|---|---|---|
| 1 | CTO plans once, then delivers gate by gate | CTO lên plan một lần, giao việc theo từng gate |
| 2 | Contract-first API | Contract-first API |
| 3 | The CTO splits the team | CTO tự chia team |
| 4 | Blind verifier on every gate | Verifier độc lập ở mọi gate |
| 5 | No fake tests, no 500s | Không test giả, không lỗi 500 |
| 6 | Opus batch review | Opus review theo đợt |
| 7 | Lean on tokens | Tiết kiệm token |
| 8 | ripgrep instead of grep | ripgrep thay cho grep |
| 9 | Picks up after a reset | Làm tiếp sau khi reset |
| 10 | Report a non-coder can read | Báo cáo người không code cũng đọc được |

"In order" means: the first occurrence of name k+1 in the file comes after the first occurrence of name k.
Write each name as plain text in the HTML source (no `&amp;`-style entities, no tags splitting the name), NFC Unicode.
A name may appear earlier in the file (for example in a meta tag) only if all ten keep the order above.
Do not put feature names in `<title>`, meta description or JSON-LD, so the order check is not disturbed.

## Pages: `docs/index.html` (EN) and `docs/vi/index.html` (VI)
- `<html lang="en">` / `<html lang="vi">`.
- In `<head>`, both pages, exactly these two alternates (plus `x-default` pointing at the EN URL):
  `<link rel="alternate" hreflang="en" href="https://cto-team-skill.pages.dev/">`
  `<link rel="alternate" hreflang="vi" href="https://cto-team-skill.pages.dev/vi/">`
  `<link rel="alternate" hreflang="x-default" href="https://cto-team-skill.pages.dev/">`
- `<link rel="canonical">` = the page's own landing URL.
- Language switch (visible in the header): EN page has `<a href="vi/" hreflang="vi" lang="vi">` labelled `VI`;
  VI page has `<a href="../" hreflang="en" lang="en">` labelled `EN`. The current language is shown, not linked,
  with `aria-current="page"`. Relative links work on Cloudflare Pages and on a local static server.
- An element with `id="installCmd"` whose text contains both install lines.
- Exactly one `<h1>`. Each feature name is the full text of one `<h2>` or `<h3>`.
- A CSS `@media (prefers-reduced-motion: reduce)` rule.
- One `<script type="application/ld+json">` with `"@type": "SoftwareApplication"`.
- `docs/landing-draft.html` no longer exists.

## READMEs: `README.md` (EN) and `README.vi.md` (VI)
- `README.md` links to `README.vi.md` with the label `Tiếng Việt`, and to `https://cto-team-skill.pages.dev/`.
- `README.vi.md` links to `README.md` with the label `English`, and to `https://cto-team-skill.pages.dev/vi/`.
- Headings: EN `## Install`, `## Use`; VI `## Cài đặt`, `## Cách dùng`.
- Each has at least one fenced block starting with ```` ```mermaid ````, containing a `flowchart`.
- Each has a feature table with the ten names of its language, in order, one row per feature.

## Local check server
`python -m http.server 8080 --directory docs` then open `http://localhost:8080/` and `http://localhost:8080/vi/`.
