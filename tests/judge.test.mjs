import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { judge } from '../skills/deliver/scripts/cto-judge.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'deliver', 'scripts', 'cto-judge.mjs');
const ok = (id, evidence = 'pytest: 1 passed') => ({ id, criterion: `criterion ${id}`, pass: true, severity: 'Important', evidence });
const report = (over = {}) => ({
  verdict: 'PASS',
  criteria: [ok('G1-T1#1'), ok('G1-T1#2')],
  mutation: { checked: false, caught: null, restored: null },
  suite: { cmd: 'pytest -q', exit: 0, summary: '42 passed' },
  junk: [],
  uiUnverified: [],
  ...over,
});
const opts = { expect: [['G1-T1', 2]], testCmd: 'pytest -q' };

test('a complete green report passes', () => {
  assert.equal(judge(report(), opts).verdict, 'PASS');
  // A wrapped command still counts as the test command.
  assert.equal(judge(report({ suite: { cmd: 'cd app && pytest -q', exit: 0, summary: '42 passed' } }), opts).verdict, 'PASS');
});

test('a failure with evidence, a red suite or junk goes to a fixer (FAIL)', () => {
  const bad = report({ verdict: 'FAIL', criteria: [ok('G1-T1#1'), { id: 'G1-T1#2', criterion: 'other user data hidden', pass: false, severity: 'Critical', evidence: 'GET /groups/2 -> 200' }] });
  const r = judge(bad, opts);
  assert.equal(r.verdict, 'FAIL');
  assert.equal(r.failing[0].severity, 'Critical');
  assert.equal(judge(report({ suite: { cmd: 'pytest -q', exit: 1, summary: '1 failed' } }), opts).verdict, 'FAIL');
  assert.equal(judge(report({ junk: ['debug.log'] }), opts).verdict, 'FAIL');
});

test('a lenient verifier cannot pass: verdict PASS with a failing criterion is FAIL', () => {
  const lenient = report({ criteria: [ok('G1-T1#1'), { id: 'G1-T1#2', criterion: 'password hashed', pass: false, severity: 'Critical', evidence: 'plaintext in db' }] });
  assert.equal(judge(lenient, opts).verdict, 'FAIL');
});

test('a failure without evidence is BLOCKED as UNPROVEN, never sent to a fixer', () => {
  const r = judge(report({ criteria: [ok('G1-T1#1'), { id: 'G1-T1#2', criterion: 'vague worry', pass: false, severity: 'Important', evidence: '' }] }), opts);
  assert.equal(r.verdict, 'BLOCKED');
  assert.match(r.reason, /^UNPROVEN:/);
});

test('report holes are GAPS (ask a fresh verifier), not code faults', () => {
  for (const hole of [
    { criteria: [ok('G1-T1#1')] },                                        // missing id
    { suite: { cmd: 'check;test', exit: 0, summary: '42 passed' } },      // paraphrased command
    { suite: undefined },                                                 // no suite
    { verdict: 'FAIL' },                                                  // bare FAIL
  ]) {
    const r = judge(report(hole), opts);
    assert.equal(r.verdict, 'GAPS', JSON.stringify(hole));
    assert.equal(r.failing.length, 0);
  }
});

test('critical work needs a completed mutation check; an uncaught mutation is a FAIL', () => {
  const c = { ...opts, critical: true };
  assert.equal(judge(report(), c).verdict, 'BLOCKED');
  assert.equal(judge(report({ mutation: { checked: true, caught: null, restored: true } }), c).verdict, 'BLOCKED');
  assert.equal(judge(report({ mutation: { checked: true, caught: false, restored: true } }), c).verdict, 'FAIL');
  assert.equal(judge(report({ mutation: { checked: true, caught: true, restored: true } }), c).verdict, 'PASS');
});

test('a carried review finding passes only when re-checked as passing with evidence, at its own severity', () => {
  const c = { ...opts, carried: [{ id: 'F1', severity: 'Critical' }] };
  assert.equal(judge(report(), c).verdict, 'GAPS');
  const still = report({ criteria: [...report().criteria, { id: 'F1', criterion: 'race on save', pass: false, severity: 'Minor', evidence: 'still lost update' }] });
  const r = judge(still, c);
  assert.equal(r.verdict, 'FAIL');
  assert.equal(r.failing[0].severity, 'Critical');
  assert.equal(judge(report({ criteria: [...report().criteria, ok('F1', 'two saves -> both kept')] }), c).verdict, 'PASS');
});

test('CLI reads the result file, prints the verdict and exits 0 only on PASS', () => {
  const d = mkdtempSync(join(tmpdir(), 'cto-judge-'));
  const f = join(d, 'G1.json');
  writeFileSync(f, '﻿' + JSON.stringify(report()));
  const run = (...a) => spawnSync(process.execPath, [SCRIPT, f, ...a], { encoding: 'utf8' });
  const pass = run('--expect', 'G1-T1:2', '--test', 'pytest -q');
  assert.equal(pass.status, 0);
  assert.equal(JSON.parse(pass.stdout).verdict, 'PASS');
  const gaps = run('--expect', 'G1-T1:3');
  assert.equal(gaps.status, 1);
  assert.equal(JSON.parse(gaps.stdout).verdict, 'GAPS');
});
