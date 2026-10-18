# Tech debt: landing v2

- G1: both pages log a favicon.ico 404 in the console; add an inline data-URI favicon.
- G1: VI proof point 7 keeps the English phrase "12k vs 42k start context"; same numbers, could read more natural in Vietnamese.
- G1: Google Fonts could not load in the check sandbox, so Vietnamese glyph rendering in Bricolage Grotesque / IBM Plex was not seen in a browser (the families list a Vietnamese subset).
- G1: Copy button success path ("Copied.") not exercised headless; only the select-text fallback was.
