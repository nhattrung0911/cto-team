# cto-team

**You are the CEO. Claude is your CTO.** You describe what you want; the CTO plans it with you once, then builds
it with a small team of fresh Sonnet workers, gate by gate, and only moves on when an independent verifier has
proven the gate works. At the end you get a plain-language report: what was built, how to try it, the tech stack,
an architecture diagram, and what is still missing.

Made for vibe coders who are not engineers but want results that hold up.

## Install

In Claude Code:

```
/plugin marketplace add nhattrung0911/cto-team
/plugin install cto-team@cto-team
```

Recommended (not required):
- [superpowers](https://github.com/obra/superpowers) for planning (`brainstorming` + `writing-plans`). Without it,
  use the built-in `/cto-team:plan`.
- Playwright MCP, so the verifier can check web pages in a real browser. Without it, UI checks fall back to the
  project's own E2E tests or are reported as `UNVERIFIED`.

## Use

1. **Plan once with your CTO**
   - With superpowers: just describe your idea; it brainstorms with you and writes a spec and a plan.
   - Without superpowers: `/cto-team:plan`.
2. **Clear the context**: `/clear`. The plan is saved on disk, so nothing is lost and delivery starts small.
3. **Deliver**: `/cto-team:deliver docs/superpowers/plans/<your-plan>.md`. The CTO first asks how many Sonnet
   workers per gate you want (1–5, default 3): more workers per gate means faster gates and more tokens per gate.

The CTO then works alone. It only comes back to you for a scope change, a destructive action, a paid service,
a secret it needs, or a legal/privacy risk.

## How a gate works

```
CTO writes the contract (API routes, fields, status codes) once, then per gate:
CTO writes briefs ──► 1–5 Sonnet workers (you pick) (one task each, fresh, one-shot; never edit the contract)
                  ──► blind verifier: full test suite, evidence per criterion, contract check, light mutation check, junk check
                  ──► up to 2 fix rounds (fresh fixer + fresh verifier; the last fixer is Opus)
                  ──► CTO: file-ownership check with git, PASS → commit, next gate · FAIL/BLOCKED → re-brief, split, or ask you
After the last gate: a whole-app check, one Opus review of the whole branch, and your report.
```

Failures the verifier cannot back with evidence are never sent to fixers and never pass on their own: the gate
stops as `UNPROVEN` and the CTO decides. Review and user-test findings get ids (`F1`, `U1`) that the next verifier
must re-check one by one.

Each gate runs as one Claude Code Workflow, so the CTO's context only receives one short result per gate.
Workers never see the whole plan or the chat history, and are never reused.

What lands in your project:

```
docs/cto/gates.md      gate map and status
docs/cto/briefs/       one brief per task
docs/cto/results/      verifier evidence per gate
docs/cto/ledger.md     what passed, and every decision the CTO made
docs/cto/techdebt.md   known non-critical gaps
docs/cto/report.html   your report
docs/contract/         the API contract (only the CTO edits it)
```

Work happens on a branch `cto/<plan-name>`; your existing changes are committed first as a baseline.

Inside a cto-team project the plugin's hook blocks `grep`, `findstr` and `Select-String` in the shell and points
the agents to ripgrep (the Grep tool or `rg`), which is faster and respects `.gitignore`. Outside cto-team
projects the hook does nothing. It is a convenience, not a security boundary: an unusual command (an alias,
`env grep`, a nested shell) can slip past it.

Tested with Claude Code 2.1.301 (needs the Workflow tool and plugin agents).

Workers, fixers, verifiers and reviewers run as the plugin's lean agents (`agents/worker.md`, `agents/checker.md`):
each gets only the tools its role needs and no skills listing, so it starts with about 12k tokens of context instead
of about 42k. Checkers have no Edit tool and are told never to change source (the verifier only breaks one line on
purpose and restores it). This is an instruction boundary, not a permission sandbox: they still have shell access.

The CTO changes gate status only through a small script (`docs/cto/cto-state.mjs`) that refuses illegal moves, such
as starting a gate before its dependencies passed or passing one without its result file.

For apps with a UI, the final check also sends a fresh "user tester" through the main flows like a non-technical
person (phone and desktop), so confusing errors and dead ends get fixed before you see the app.

## Test rules the team follows

- No fake tests (`assert True`, testing a mock, no assertion). Every test must be able to fail.
- Cover the cases that usually break: boundaries, empty input, Unicode/Vietnamese text, malformed files,
  permissions (seeing other users' data), concurrent edits, time zones, money rounding, network failures, XSS.
- On critical gates (money, auth, data writes) the verifier breaks one line on purpose and checks a test catches it.
- Real tests stay in the repo and re-run every gate; temporary scripts, screenshots and logs must be deleted.
- Security, money, data-loss, permission and main-path crash issues are never parked as tech debt.

## Recommended settings (optional, copy yourself)

The plugin never changes your settings. These values worked well on a Claude Max 5x plan; add them to
`~/.claude/settings.json` if you want:

```json
{
  "env": {
    "CLAUDE_CODE_AUTO_COMPACT_WINDOW": "500000",
    "CLAUDE_CODE_SUBAGENT_MODEL": "sonnet",
    "CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS": "6",
    "BASH_MAX_OUTPUT_LENGTH": "15000"
  },
  "workflowSizeGuideline": "medium"
}
```

- Auto-compact at 500k keeps long sessions from re-reading near-1M contexts every turn.
- Sonnet as default subagent model keeps worker cost low; the CTO stays on your main model (Opus recommended).

## Credits

Ideas adapted from [obra/superpowers](https://github.com/obra/superpowers) and
[olsenbrands/fable-foreman](https://github.com/olsenbrands/fable-foreman), both MIT. See `NOTICE`.

License: MIT.
