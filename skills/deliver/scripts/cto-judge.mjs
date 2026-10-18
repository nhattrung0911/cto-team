#!/usr/bin/env node
// Judges a cto-team verifier or reviewer result file, so a lenient report cannot pass a gate.
// Usage:
//   node docs/cto/cto-judge.mjs <result.json> [--expect G1-T1:4,G1-T2:3,GOAL:2] [--test "<test cmd>"]
//                               [--critical] [--carried F1:Important,F2:Critical]
// Prints one JSON line {verdict, failing, gaps, minor, reason}. Exit 0 only for PASS.
// Verdicts: PASS; FAIL (code faults with evidence: give them to a fixer); GAPS (the report is incomplete: ask a
// fresh verifier, not a fixer); BLOCKED (unproven failure or unsafe mutation: the CTO decides).
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SEV = ['Critical', 'Important', 'Minor'];
const proven = (e) => String(e || '').trim().length >= 3;
const squash = (x) => String(x || '').trim().replace(/\s+/g, ' ');
const cid = (c) => String(c.id || '').replace(/[\[\]]/g, '');

export function judge(v, { expect = [], testCmd = '', critical = false, carried = [] } = {}) {
  const blocked = (reason) => ({ verdict: 'BLOCKED', failing: [], gaps: [], minor: [], reason })
  if (!v || typeof v !== 'object') return blocked('no verifier result')
  const criteria = Array.isArray(v.criteria) ? v.criteria : []
  const junk = Array.isArray(v.junk) ? v.junk : []
  const m = v.mutation || {}
  if (m.restored === false) return blocked('mutation check did not restore the code; working tree may be wrong')
  if (critical && (m.checked !== true || m.restored !== true)) return blocked('critical: mutation check not completed')
  if (critical && m.caught !== true && m.caught !== false) return blocked('critical: mutation check did not say whether tests caught the break')
  const main = (v.uiUnverified || []).filter((u) => /^MAIN:/i.test(u))
  if (main.length) return blocked(`cannot verify the main flow: ${main.join('; ')}`)

  const carriedIds = carried.map((c) => c.id)
  const own = criteria.filter((c) => !carriedIds.includes(cid(c)))
  const blocking = (c) => !c.pass && c.severity !== 'Minor'
  const unproven = own.filter((c) => blocking(c) && !proven(c.evidence))
  if (unproven.length) return blocked(unproven.map((c) => `UNPROVEN: [${c.severity}] ${c.criterion}`).join('; '))

  const failing = own.filter((c) => blocking(c)).map((c) => ({ criterion: c.criterion, severity: SEV.includes(c.severity) ? c.severity : 'Important', evidence: c.evidence }))
  const minor = own.filter((c) => !c.pass && c.severity === 'Minor').map((c) => ({ criterion: c.criterion, evidence: c.evidence }))
  const gaps = []
  if (m.checked && m.caught === false) failing.push({ criterion: 'tests do not catch the mutated behaviour', severity: 'Important', evidence: 'mutation check: related tests still passed' })
  if (criteria.length === 0) gaps.push('no criteria reported')
  if (!v.suite) gaps.push('full suite run not reported in `suite`')
  else {
    if (testCmd && !squash(v.suite.cmd).includes(squash(testCmd))) gaps.push(`suite.cmd "${v.suite.cmd}" is not the test command "${testCmd}"`)
    if (!String(v.suite.summary || '').trim()) gaps.push('suite.summary is empty')
    if (v.suite.exit !== 0) failing.push({ criterion: 'full suite is not green', severity: 'Important', evidence: `${v.suite.cmd} exit ${v.suite.exit}: ${v.suite.summary || ''}` })
  }
  const ids = new Map(criteria.filter((c) => c.id).map((c) => [cid(c), c]))
  for (const [prefix, n] of expect) {
    for (let k = 1; k <= n; k++) if (!ids.has(`${prefix}#${k}`)) gaps.push(`${prefix}#${k} not checked`)
  }
  // A carried finding keeps its original severity and passes only when re-checked as passing, with evidence.
  for (const { id, severity } of carried) {
    const c = ids.get(id)
    if (!c) gaps.push(`${id} not re-checked`)
    else if (!c.pass || !proven(c.evidence)) failing.push({ criterion: `${id} still failing or not proven fixed: ${c.criterion}`, severity, evidence: c.evidence || 'no evidence' })
  }
  junk.forEach((f) => failing.push({ criterion: `remove temporary file: ${f}`, severity: 'Important', evidence: 'junk check' }))
  if (failing.length) return { verdict: 'FAIL', failing, gaps, minor }
  if (v.verdict !== 'PASS' && gaps.length === 0) gaps.push('verdict FAIL but no failing criterion with evidence')
  return { verdict: gaps.length ? 'GAPS' : 'PASS', failing, gaps, minor }
}

function parseArgs(argv) {
  const opts = { expect: [], testCmd: '', critical: false, carried: [] }
  let file
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--critical') opts.critical = true
    else if (a === '--test') opts.testCmd = argv[++i] || ''
    else if (a === '--expect') opts.expect = String(argv[++i] || '').split(',').filter(Boolean).map((s) => {
      const [p, n] = s.split(':')
      if (!p || !(Number(n) > 0)) throw new Error(`bad --expect item "${s}" (want PREFIX:COUNT)`)
      return [p, Number(n)]
    })
    else if (a === '--carried') opts.carried = String(argv[++i] || '').split(',').filter(Boolean).map((s) => {
      const [id, severity = 'Important'] = s.split(':')
      return { id, severity }
    })
    else file = a
  }
  if (!file) throw new Error('usage: cto-judge.mjs <result.json> [--expect P:N,...] [--test "<cmd>"] [--critical] [--carried F1:Important,...]')
  return { file, opts }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    const { file, opts } = parseArgs(process.argv.slice(2))
    const r = judge(JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, '')), opts)
    console.log(JSON.stringify(r))
    process.exit(r.verdict === 'PASS' ? 0 : 1)
  } catch (e) {
    console.log(JSON.stringify({ verdict: 'BLOCKED', failing: [], gaps: [], minor: [], reason: `judge error: ${e.message}` }))
    process.exit(1)
  }
}
