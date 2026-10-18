# Tech debt: landing v2

- G1: both pages log a favicon.ico 404 in the console; add an inline data-URI favicon.
- G1: VI proof point 7 keeps the English phrase "12k vs 42k start context"; same numbers, could read more natural in Vietnamese.
- G1: Google Fonts could not load in the check sandbox, so Vietnamese glyph rendering in Bricolage Grotesque / IBM Plex was not seen in a browser (the families list a Vietnamese subset).
- G1: Copy button success path ("Copied.") not exercised headless; only the select-text fallback was.
- REVIEW-1: tests/docs.test.mjs does not check x-default, canonical, aria-current, NFC source text, or "no feature names in <title>"; version check is a loose substring.
- REVIEW-1: no test guards EN/VI drift in Before/After/proof points or the README table shape.
- REVIEW-1: README.vi.md leaves out the EN notes "not a security boundary" (rg hook) and "instruction boundary, not a permission sandbox" (lean agents), the NOTICE credit, and some settings; the VI Mermaid fail/pass edges have no labels.
- REVIEW-1: docs/vi/index.html proof point 5 says "số 20 chữ số" (drops "tiền"/amount); README.vi.md says "số tiền".
- REVIEW-1: the autoplaying gate diagram updates a polite live region every 2.2 s until paused; screen-reader users hear it repeatedly. Announce only on user-driven steps.
- REVIEW-1: serving docs/ as the site root also publishes docs/cto/, docs/contract/, docs/specs/, docs/plans/ (public in the repo anyway, no secrets); no robots.txt or sitemap.xml. Deploy only index.html and vi/ (see report).
