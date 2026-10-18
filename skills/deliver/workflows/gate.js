export const meta = {
  name: 'cto-team-gate',
  description: 'One cto-team gate: workers, blind verifier, fix rounds',
  phases: [{ title: 'Build' }, { title: 'Verify' }, { title: 'Fix' }],
}

// Runs one gate for the cto-team CTO. Input: args (see skills/deliver/SKILL.md).
// Output: one compact result; full detail is written by the verifier to args.resultPath.

const DEFAULT_WORKERS = 3
const HARD_MAX_WORKERS = 5
const MAX_FIX_ROUNDS = 2
const MODEL = 'sonnet'
const STRONG = 'opus' // whole-branch reviewer and the last fix round

const STATUS = ['DONE', 'DONE_WITH_CONCERNS', 'BLOCKED', 'FAILED']
const str = { type: 'string' }
const strs = { type: 'array', items: str }
const WORKER = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: STATUS },
    files: strs,
    tests: { type: 'array', items: { type: 'object', properties: { cmd: str, result: str }, required: ['cmd', 'result'] } },
    concerns: strs,
  },
  required: ['status', 'files', 'tests', 'concerns'],
}
const FIXER = {
  type: 'object',
  properties: { ...WORKER.properties, rootCause: str },
  required: [...WORKER.required, 'rootCause'],
}
const VERIFIER = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['PASS', 'FAIL'] },
    criteria: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: str,
          criterion: str,
          pass: { type: 'boolean' },
          severity: { type: 'string', enum: ['Critical', 'Important', 'Minor'] },
          evidence: str,
        },
        required: ['criterion', 'pass', 'severity', 'evidence'],
      },
    },
    mutation: {
      type: 'object',
      properties: {
        checked: { type: 'boolean' },
        caught: { type: ['boolean', 'null'] },
        restored: { type: ['boolean', 'null'] },
      },
      required: ['checked', 'caught', 'restored'],
    },
    suite: {
      type: 'object',
      properties: { cmd: str, exit: { type: 'number' }, summary: str },
      required: ['cmd', 'exit', 'summary'],
    },
    junk: strs,
    uiUnverified: strs,
  },
  required: ['verdict', 'criteria', 'mutation', 'suite', 'junk', 'uiUnverified'],
}
const REVIEWER = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['Critical', 'Important', 'Minor'] },
          file: str,
          issue: str,
          evidence: str,
          fix: str,
        },
        required: ['severity', 'file', 'issue', 'evidence', 'fix'],
      },
    },
  },
  required: ['findings'],
}

const a = args || {}
const mode = a.mode || 'gate'
const tasks = a.tasks || []
// Team size chosen by the CEO at setup (args.maxWorkers), 1..5, default 3.
const posInt = (n) => Number.isInteger(n) && n > 0
const maxWorkers = Math.min(HARD_MAX_WORKERS, Math.max(1, Math.floor(Number(a.maxWorkers)) || DEFAULT_WORKERS))
if (tasks.length > maxWorkers) throw new Error(`cto-team gate: max ${maxWorkers} tasks per gate (got ${tasks.length})`)
if (mode === 'gate' && tasks.length === 0) throw new Error('cto-team gate: gate mode needs at least 1 task')
if (mode === 'review' && (!a.branchBase || !(a.finalBriefs || []).length)) {
  throw new Error('cto-team gate: review mode needs branchBase and finalBriefs')
}
if (mode === 'final' && !(a.finalBriefs || []).length) throw new Error('cto-team gate: final mode needs finalBriefs')
if (mode === 'final' && !posInt(a.goals)) throw new Error('cto-team gate: final mode needs goals (the number of spec goals, each checked as GOAL#<n>)')
// The verifier's review range: the gate's own base, or the batch/branch base for review and final (never a gate base).
const rangeBase = mode === 'gate' ? a.gateBase : a.branchBase
if (!rangeBase) throw new Error(`cto-team gate: ${mode} mode needs a base commit (${mode === 'gate' ? 'gateBase' : 'branchBase'})`)
// The mutation check guards new gate work; the review's fix check stays cheap.
const mutate = Boolean(a.critical) && mode !== 'review'
// Canonical relative path: forward slashes, no '.', no empty segments, '..' resolved, case-insensitive.
const norm = (f) => {
  const out = []
  for (const part of String(f).replace(/\\/g, '/').split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return out.join('/').toLowerCase()
}
// Relative to the project root and never escaping it.
const inside = (f) => {
  const raw = String(f).replace(/\\/g, '/')
  if (/^([a-z]:|\/)/i.test(raw)) return false
  let depth = 0
  for (const part of raw.split('/')) {
    if (part === '..') depth--
    else if (part !== '' && part !== '.') depth++
    if (depth < 0) return false
  }
  return true
}
for (const p of [...tasks.flatMap((t) => [t.brief, ...(t.files || [])]), ...(a.finalBriefs || [])]) {
  if (p != null && !inside(p)) throw new Error(`cto-team gate: path ${p} must be relative and inside the project`)
}
const contract = (a.contract || []).map(String)
// Lean plugin agents (agents/*.md): only the tools each role needs, no skills listing (~12k vs ~42k start context).
const lean = a.lean !== false
const BUILDER = lean ? { agentType: 'cto-team:worker' } : {}
const CHECKER = lean ? { agentType: 'cto-team:checker' } : {}
const contractKeys = new Set(contract.map(norm))
const seen = new Set()
const owner = new Map()
for (const t of tasks) {
  if (seen.has(t.id) || seen.has(t.brief)) throw new Error(`cto-team gate: duplicate task id or brief (${t.id})`)
  seen.add(t.id)
  seen.add(t.brief)
  if (!Array.isArray(t.files) || t.files.length === 0) throw new Error(`cto-team gate: task ${t.id} needs files[]`)
  if (!posInt(t.criteria)) throw new Error(`cto-team gate: task ${t.id} needs criteria (the number of acceptance criteria in its brief)`)
  for (const f of t.files) {
    const key = norm(f)
    if (contractKeys.has(key)) throw new Error(`cto-team gate: ${t.id} lists contract file ${f}; only the CTO edits the contract`)
    if (owner.has(key)) throw new Error(`cto-team gate: ${owner.get(key)} and ${t.id} share file ${f}; put them in different gates`)
    owner.set(key, t.id)
  }
}

const q = (p) => `"${p}"`
// Join with the separator the base path already uses (Windows or POSIX).
const join = (base, rel) => {
  const sep = String(base).includes('\\') ? '\\' : '/'
  return String(base).replace(/[\\/]+$/, '') + sep + String(rel).replace(/[\\/]+/g, sep)
}
const ref = (name) => q(join(a.refs, name))
const inRoot = (rel) => q(join(a.projectRoot, rel))
// Each stage writes its own detail file next to resultPath: X.json (first verifier), X.r<n>.json, X.review.json, X.user.json.
const stagePath = (tag) => (tag ? String(a.resultPath).replace(/(\.json)?$/i, `.${tag}.json`) : a.resultPath)
const clip = (s, n = 300) => (String(s).length > n ? String(s).slice(0, n) + '…' : String(s))
const briefs = mode === 'gate' ? tasks.map((t) => t.brief) : a.finalBriefs || []
const common = [
  `Project root: ${q(a.projectRoot)}`,
  `Test command: ${a.testCmd || '(see the brief)'}`,
  a.appStart ? `App start command: ${a.appStart}` : 'App start command: none',
  contract.length ? `Contract (read-only, only the CTO edits it): ${contract.map(q).join(', ')}` : '',
].filter(Boolean).join('\n')
const contractRule = contract.length
  ? 'Never edit the contract. If it is missing or wrong for your task, return BLOCKED with a concern starting "CONTRACT: <what must change>".'
  : ''

const concerns = []
const blockers = []
let reviewFindings = []
let reviewMinor = []

// Build
if (mode === 'gate') {
  phase('Build')
  const reports = await parallel(tasks.map((t) => () =>
    agent(
      [
        `You are a cto-team worker. Read and follow the instructions in ${ref('worker-prompt.md')}.`,
        `Your task brief is ${inRoot(t.brief)} (task ${t.id}). Read only this brief.`,
        common,
        contractRule,
      ].filter(Boolean).join('\n'),
      { label: `worker:${t.id}`, phase: 'Build', model: MODEL, schema: WORKER, ...BUILDER },
    ),
  ))
  reports.forEach((r, i) => {
    const id = tasks[i].id
    if (!r) { blockers.push(`${id}: worker returned no result; re-run the gate`); return }
    r.concerns.forEach((c) => concerns.push(`${id}: ${clip(c)}`))
    if (r.status === 'BLOCKED') blockers.push(`${id}: ${r.concerns.map((c) => clip(c)).join('; ') || 'blocked'}`)
    else r.concerns.filter(isContract).forEach((c) => blockers.push(`${id}: ${clip(c)}`))
    if (r.status === 'FAILED') concerns.push(`${id}: worker reported FAILED`)
  })
  if (blockers.length) {
    return compact('BLOCKED', 0, null)
  }
}

// Review: one whole-branch reviewer on the strongest model.
if (mode === 'review') {
  phase('Review')
  const rv = await agent(
    [
      `You are the cto-team reviewer. Read and follow ${ref('reviewer-prompt.md')} and ${ref('test-policy.md')}.`,
      `Review range: git diff ${a.branchBase}..HEAD (a batch of gates, or the whole branch). Read other code only to check how this range interacts with it.`,
      'Requirements: the spec and plan under docs/, and these briefs:',
      ...briefs.map((b) => `- ${inRoot(b)}`),
      `Write the full detail, with steps to reproduce each finding, to ${inRoot(stagePath('review'))} (path relative to the root: ${stagePath('review')}).`,
      common,
    ].join('\n'),
    { label: `review:${a.gate}`, phase: 'Review', model: STRONG, schema: REVIEWER, ...CHECKER },
  )
  if (!rv) {
    blockers.push('reviewer returned no result')
    return compact('BLOCKED', 0, null)
  }
  // A finding without reproduced evidence is Minor at most (reviewer-prompt.md).
  const blocking = (f) => f.severity !== 'Minor' && proven(f.evidence)
  reviewFindings = rv.findings.filter(blocking).map((f, i) => ({ ...f, id: `F${i + 1}` }))
  reviewMinor = rv.findings.filter((f) => !blocking(f)).map((f) => ({ criterion: `${f.file}: ${f.issue}`, evidence: f.evidence }))
  if (reviewFindings.length === 0) return compact('PASS', 0, null, { failing: [], minor: [] })
}
const findingLine = (f) => `- [${f.id}] [${f.severity}] ${f.file}: ${f.issue} — evidence: ${clip(f.evidence)} — suggested fix: ${clip(f.fix, 200)}`
const reviewLines = reviewFindings.map(findingLine)
// Findings carried into the fix rounds; the verifier must re-check each one by id, at the original severity.
const carried = reviewFindings.map((f) => f.id)
const carriedSeverity = new Map(reviewFindings.map((f) => [f.id, f.severity]))

// Verify + fix rounds
// gaps: what the previous verifier report left out (a recheck re-runs the verifier, never a fixer).
const verify = (round, gaps = []) => {
  phase('Verify')
  const tag = [round ? `r${round}` : '', gaps.length ? 'recheck' : ''].filter(Boolean).join('.')
  return agent(
    [
      `You are the cto-team verifier for gate ${a.gate}. Read and follow ${ref('verifier-prompt.md')} and ${ref('test-policy.md')}.`,
      ...(gaps.length ? ['The previous verifier report was incomplete. Verify the gate again and this time also cover:', ...gaps.map((g) => `- ${clip(g, 250)}`)] : []),
      `Acceptance criteria come only from these briefs:`,
      ...briefs.map((b) => `- ${inRoot(b)}`),
      `Review range: git diff ${rangeBase}..HEAD plus the working tree.`,
      'Give every criterion an id: <task id>#<its number in the brief> (e.g. G2-T1#3). Report the full suite run in `suite` (command, exit code, one-line summary). Run the test command above and put it in `suite.cmd` exactly as given: copy it, add flags only, never shorten or paraphrase it.',
      mode === 'final' ? `Also check each spec goal (numbered in the spec or in docs/cto/gates.md) end to end and report it as GOAL#1 … GOAL#${a.goals}.` : '',
      ...(reviewLines.length ? ['Also report each of these findings as a criterion with its id ([F1], [U1], …): it must now be fixed and covered by a regression test that fails without the fix (no such test = Important failing criterion):', ...reviewLines] : []),
      mutate
        ? 'Run the mutation check (critical gate): pick the file, record `git hash-object <file>` (works for new untracked files too), make one one-line break, run the related test file, then revert only that line by editing it back (never git checkout, git restore or git stash: the workers\' changes are uncommitted), and confirm `git hash-object <file>` matches again.'
        : 'Skip the mutation check (non-critical gate); report mutation {checked:false, caught:null, restored:null}.',
      'Ignore docs/cto/ (the CTO\'s own files) in the junk and out-of-scope checks.',
      contract.length ? 'Contract conformance: check that the running app matches the contract (routes, field names and types, status codes); a mismatch is an Important failing criterion.' : '',
      mode === 'final' ? 'This is the FINAL whole-app check: run the full suite, build, and the main user flow end to end.' : '',
      `Write the full detail to ${inRoot(stagePath(tag))} (path relative to the root: ${stagePath(tag)}).`,
      common,
    ].filter(Boolean).join('\n'),
    { label: `verify:${a.gate}:r${round}${gaps.length ? ':recheck' : ''}`, phase: 'Verify', model: MODEL, schema: VERIFIER, ...CHECKER },
  )
}

const isMain = (u) => /^MAIN:/i.test(u)
function isContract(c) { return /^\s*CONTRACT:/i.test(String(c)) }
// Evidence must be something the verifier or reviewer produced; an empty string proves nothing.
function proven(e) { return String(e || '').trim().length >= 3 }

function judge(v) {
  const blocked = (reason) => ({ verdict: 'BLOCKED', failing: [], minor: [], reason })
  if (!v) return blocked('verifier returned no result')
  const m = v.mutation || {}
  if (m.restored === false) return blocked('mutation check did not restore the code; working tree may be wrong')
  if (mutate && (m.checked !== true || m.restored !== true)) return blocked('critical gate: mutation check not completed')
  if (mutate && m.caught !== true && m.caught !== false) return blocked('critical gate: mutation check did not say whether tests caught the break')
  const main = v.uiUnverified.filter(isMain)
  if (main.length) return blocked(`cannot verify the main flow: ${main.map((u) => clip(u, 150)).join('; ')}`)
  const cid = (c) => String(c.id || '').replace(/[\[\]]/g, '')
  const own = v.criteria.filter((c) => !carried.includes(cid(c)))
  const unproven = own.filter((c) => !c.pass && c.severity !== 'Minor' && !proven(c.evidence))
  // A failure the verifier could not back with evidence is never sent to fixers and never passes: the CTO decides.
  if (unproven.length) return blocked(unproven.map((c) => `UNPROVEN: [${c.severity}] ${clip(c.criterion, 150)}`).join('; '))
  const failing = own.filter((c) => !c.pass && c.severity !== 'Minor' && proven(c.evidence))
  const minor = own.filter((c) => !c.pass && c.severity === 'Minor')
  // Gaps in the verifier's own report (not faults in the code): they go back to a verifier, never to a fixer.
  const gaps = []
  if (m.checked && m.caught === false) {
    failing.push({ criterion: 'tests do not catch the mutated behaviour', severity: 'Important', evidence: 'mutation check: related tests still passed' })
  }
  if (v.criteria.length === 0) gaps.push('verifier reported no criteria (empty checklist)')
  const squash = (x) => String(x || '').trim().replace(/\s+/g, ' ')
  if (!v.suite) gaps.push('verifier did not report the full suite run in `suite`')
  else {
    const suite = v.suite
    if (a.testCmd && !squash(suite.cmd).includes(squash(a.testCmd))) {
      gaps.push(`suite.cmd was "${clip(suite.cmd, 100)}", not the test command "${clip(a.testCmd, 100)}" exactly`)
    }
    if (!String(suite.summary || '').trim()) gaps.push('suite.summary is empty')
    if (suite.exit !== 0) {
      failing.push({ criterion: 'full suite is not green', severity: 'Important', evidence: `${clip(suite.cmd, 100)} exit ${suite.exit}: ${clip(suite.summary, 150) || '(no summary)'}` })
    }
  }
  const ids = new Map(v.criteria.filter((c) => c.id).map((c) => [String(c.id).replace(/[\[\]]/g, ''), c]))
  const expected = mode === 'gate'
    ? tasks.flatMap((t) => Array.from({ length: t.criteria }, (_, k) => `${t.id}#${k + 1}`))
    : mode === 'final' ? Array.from({ length: a.goals }, (_, k) => `GOAL#${k + 1}`) : []
  for (const id of expected) {
    if (!ids.has(id)) gaps.push(`${id} not checked by the verifier (no criterion with id ${id})`)
  }
  // A carried finding keeps its original severity and passes only when re-checked as passing, with evidence.
  for (const id of carried) {
    const c = ids.get(id)
    const sev = carriedSeverity.get(id) || 'Important'
    if (!c) gaps.push(`${id} not re-checked by the verifier (no criterion with id ${id})`)
    else if (!c.pass || !proven(c.evidence)) {
      failing.push({ criterion: `${id} still failing or not proven fixed: ${clip(c.criterion, 150)}`, severity: sev, evidence: proven(c.evidence) ? c.evidence : 'no evidence given' })
    }
  }
  if (failing.length > 0 || v.junk.length > 0) return { verdict: 'FAIL', failing, minor, gaps }
  if (v.verdict !== 'PASS' && gaps.length === 0) gaps.push('verifier said FAIL but named no failing criterion with evidence')
  return { verdict: gaps.length ? 'FAIL' : 'PASS', failing, minor, gaps }
}

// Verify, and when the only problems are gaps in the report, ask a fresh verifier once more; still gaps: the CTO decides.
async function verifyChecked(round) {
  v = await verify(round)
  j = judge(v)
  if (j.verdict !== 'FAIL' || j.failing.length || v.junk.length) return
  v = await verify(round, j.gaps)
  j = judge(v)
  if (j.verdict !== 'FAIL' || j.failing.length || v.junk.length) return
  const gapRows = j.gaps.map((g) => ({ criterion: g, severity: 'Important', evidence: 'verifier report incomplete twice' }))
  j = { verdict: 'BLOCKED', failing: gapRows, minor: j.minor, reason: `REPORT: verifier report incomplete twice: ${j.gaps.map((g) => clip(g, 150)).join('; ')}` }
}

let round = 0
let v
let j
if (mode === 'review') {
  // Review findings are the first failure; go straight to a fix round.
  v = { junk: [], uiUnverified: [], mutation: { checked: false, caught: null, restored: null } }
  j = { verdict: 'FAIL', failing: reviewFindings.map((f) => ({ criterion: `[${f.id}] ${f.file}: ${f.issue}`, severity: f.severity, evidence: f.evidence })), minor: [] }
} else {
  await verifyChecked(round)
  if (mode === 'final' && a.userTest) {
    // A fresh non-technical user tries the main flows; proven problems join the fix rounds.
    phase('User test')
    const ut = await agent(
      [
        `You are the cto-team user tester. Read and follow ${ref('user-tester-prompt.md')}.`,
        'Who you are and what you want: the spec under docs/ (Intent, Users and main flows, Anti-goals).',
        `Write what you did and saw, step by step, to ${inRoot(stagePath('user'))} (path relative to the root: ${stagePath('user')}).`,
        common,
      ].join('\n'),
      { label: `user:${a.gate}`, phase: 'User test', model: MODEL, schema: REVIEWER, ...CHECKER },
    )
    if (!ut) {
      blockers.push('user tester returned no result (userTest was requested)')
      return compact('BLOCKED', 0, v, j)
    } else {
      const blocking = (f) => f.severity !== 'Minor' && proven(f.evidence)
      const found = ut.findings.filter(blocking).map((f, i) => ({ ...f, id: `U${i + 1}` }))
      ut.findings.filter((f) => !blocking(f)).forEach((f) => reviewMinor.push({ criterion: `user test: ${f.file}: ${f.issue}`, evidence: f.evidence }))
      if (found.length && j.verdict !== 'BLOCKED') {
        found.forEach((f) => { reviewLines.push(findingLine(f)); carried.push(f.id); carriedSeverity.set(f.id, f.severity) })
        j = { verdict: 'FAIL', failing: [...j.failing, ...found.map((f) => ({ criterion: `[${f.id}] ${f.file}: ${f.issue}`, severity: f.severity, evidence: f.evidence }))], minor: j.minor }
      }
    }
  }
}
while (j.verdict === 'FAIL' && round < MAX_FIX_ROUNDS) {
  round++
  phase('Fix')
  const findings = [
    ...j.failing.map((c) => `- [${c.severity}] ${c.criterion} — evidence: ${clip(c.evidence)}`),
    ...v.junk.map((f) => `- [Junk] remove temporary file: ${f}`),
  ]
  const fix = await agent(
    [
      `You are a cto-team fixer (round ${round} of ${MAX_FIX_ROUNDS}) for gate ${a.gate}. Read and follow ${ref('fixer-prompt.md')}.`,
      'Briefs for this gate:',
      ...briefs.map((b) => `- ${inRoot(b)}`),
      'Verifier findings to fix:',
      ...findings,
      'State the rootCause with evidence before changing code.',
      common,
      contractRule,
    ].filter(Boolean).join('\n'),
    { label: `fix:${a.gate}:r${round}`, phase: 'Fix', model: round === MAX_FIX_ROUNDS ? STRONG : MODEL, schema: FIXER, ...BUILDER },
  )
  if (!fix) concerns.push(`fix round ${round}: fixer returned no result`)
  else if (fix.status === 'BLOCKED' || fix.concerns.some(isContract)) {
    blockers.push(`fix round ${round}: ${fix.concerns.map((c) => clip(c)).join('; ') || 'blocked'}`)
    return compact('BLOCKED', round, v, j)
  } else fix.concerns.forEach((c) => concerns.push(`fix round ${round}: ${clip(c)}`))
  await verifyChecked(round)
}

if (j.reason) blockers.push(j.reason)
if (v) v.uiUnverified.filter((u) => !isMain(u)).forEach((u) => concerns.push(`UNVERIFIED: ${clip(u)}`))
return compact(j.verdict, round, v, j)

function compact(verdict, rounds, ver, jj) {
  const jr = jj || (ver ? judge(ver) : { failing: [], minor: [] })
  return {
    gate: a.gate,
    verdict,
    rounds,
    failing: jr.failing.map((c) => ({ criterion: clip(c.criterion, 200), severity: c.severity, evidence: clip(c.evidence) })),
    minor: [...reviewMinor, ...jr.minor].map((c) => ({ criterion: clip(c.criterion, 200), evidence: clip(c.evidence) })),
    mutation: ver ? ver.mutation : { checked: false, caught: null, restored: null },
    junk: ver ? ver.junk : [],
    blockers: blockers.slice(0, 10),
    concerns: concerns.slice(0, 10),
    resultPath: a.resultPath,
  }
}
