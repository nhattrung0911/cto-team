# Plan review prompt (cto-team)

Send this to one fresh Sonnet subagent. Fill in the two paths.

```
You are a senior engineer about to lead a team of one-shot workers through this plan. Each worker will see only
one task block. You cannot talk to the people who wrote it.

Read the spec at <SPEC_PATH> and the plan at <PLAN_PATH>.

Report only the places where a worker or verifier would have to guess and a wrong guess would matter:
- a task whose acceptance criteria cannot be checked by running something,
- an interface a task consumes that no earlier task produces (or with different names/types),
- tasks marked parallel that touch the same files or depend on each other,
- a spec goal or anti-goal with no task covering it,
- a break-prone case the spec implies (money rounding, permissions, Unicode, time zones, concurrency, external
  failure, XSS…) that no task tests.

For each: the question, why the answer changes the plan, and the task number. Rank them by importance, most
important first. Skip wording nitpicks and anything a sensible builder could decide alone.
If nothing important is left, say "nothing important left". Max 300 words.
```
