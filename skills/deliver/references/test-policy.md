# cto-team test policy

Applies to every worker, fixer and verifier. Goal: tests that catch real breakage, nothing more.

## 1. Banned tests (count as missing)
- `assert True`, `expect(true).toBe(true)`, asserting a constant or a value the test itself just set.
- Tests that only check a mock returned what it was told, or that a mock was called, with no real behaviour checked.
- Tests with no assertion, tests that catch and swallow the failure, snapshot-only tests for logic.
- Tests that can never fail (skipped, `xfail` without reason, conditions always true).

A test is real if you can name the one-line production change that would make it fail.

Mandatory for every numeric input (amounts, counts, ids, pages): an overflow test with a value past the storage
limit. Bad input must never 500: it gets a clean 4xx or a reported row error.

## 2. Break-prone cases (cover the ones that apply)
| Case | Example |
|---|---|
| Boundaries / off-by-one | 0, 1, max, last page, end of month |
| Empty and missing input | empty string, empty list, missing field, `null` |
| Very large input / overflow | 10k rows, long text, numbers past the storage limit (int64, 30-digit strings) |
| Unicode / Vietnamese diacritics | "Hà Nội" vs "ha noi", emoji, NFC vs NFD |
| Malformed input | bad CSV row, BOM, decimal comma, wrong type, invalid date |
| Auth and permissions | logged out, wrong role, other user's resource (IDOR) |
| Concurrent modification | two edits of the same record, double submit |
| Time zones and dates | Asia/Ho_Chi_Minh day boundary, DST elsewhere, leap day |
| Rounding and money | integer VND, splits that must sum exactly, no float drift |
| External failure | network down, DB locked, timeout, 500 from an API |
| Idempotency | retrying the same request does not duplicate |
| Injection / XSS | `<script>` in text fields, SQL metacharacters, path traversal |

## 3. Keep real tests, delete temporary things
- Real tests live in the project's test folder and are re-run at every gate (regression).
- Delete before returning: scratch scripts, screenshots, logs, scratch databases, coverage output that is not
  gitignored, `.tmp` files, debug prints, commented-out code.

## 4. Mutation check (verifier, critical gates only)
Record `git hash-object <file>` for the file you mutate, make one one-line break of the most important behaviour, run the
related test file, edit the line back, and check the hash matches. Never git checkout, restore or stash to undo it:
the gate's work is uncommitted. Keep it cheap: one mutation per gate, never the whole suite.

## 5. What "tested" means per project type

## Web
- Server routes: status codes, permission checks, validation errors, happy path.
- UI: main flow passes in a browser at phone width (375px) and desktop; empty, loading and error states render;
  no console errors on the main flow.

## API
- Every endpoint: success, validation error (4xx), unauthenticated (401), forbidden (403/404 for other users' data).
- Contract: response fields and types match the spec.

## CLI
- Exit code 0 on success and non-zero on bad input; clear error message; `--help` works.
- Reads from file and stdin if the spec says so; handles a missing file.

## Data
- Pipelines/scripts: row counts in vs out, rejected rows reported, re-run is idempotent, encoding preserved.
- Numbers reconcile with a hand-checked sample.
