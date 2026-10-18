# <Product name> — Spec

Date: YYYY-MM-DD · CEO: <name> · CTO: Claude (cto-team)

## Intent
<What this is, who uses it, and why it matters now — in the CEO's terms. 3–6 sentences.>

## Goals
1. <Outcome the CEO will check, phrased as something a user can do. Numbered: gates.md maps gates to these.>

## Non-goals
- <Things deliberately not built in this version.>

## Anti-goals
- <What would make this a failure even if it technically works (e.g. "loses a payment", "shows one user another
  user's data", "needs a developer to add a member").>

## Users and main flows
1. <Who> does <what> → sees <result>.

## Constraints
- <Where it runs, budget, deadlines, data rules, languages, devices, accessibility.>

## Decided (by the CEO)
- <Decision in their words.>

## CTO calls (CEO may override)
- <Technical choice> — <one-line reason in plain words>.

## Contract
<Only if the product has an API or parts that talk to each other. The CEO-checked table, in plain words:>
| User action | Endpoint / interface | Data in → data out | If the user does it wrong |
|---|---|---|---|
| Add an expense | `POST /groups/{id}/expenses` | amount, payer, who shares → saved expense | amount 0 or too big → clear error |
<The deliver skill turns this into `docs/contract/openapi.yaml` (or `contract.md`).>

## Clarifications
- YYYY-MM-DD — Q: <question> → A: <CEO's answer or the recommended default they accepted>

## Open questions
- <Only if they block planning; otherwise "none".>
