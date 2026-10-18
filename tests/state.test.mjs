import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'deliver', 'scripts', 'cto-state.mjs');
const MAP = `Workers: 3 | Test: pytest -q | App: none | Contract: none
| Gate | Tasks | Files | Goals | Depends on | Critical | Status |
|------|-------|-------|-------|------------|----------|--------|
| G1 | T1 | a.py | 1 | - | yes | todo |
| G2 | T2 | b.py | 2 | G1 | yes | todo |
| REVIEW-1 | - | - | 1, 2 | G1, G2 | yes | todo |
| FINAL | - | - | 1, 2 | REVIEW-1 | yes | todo |
`;
const project = () => {
  const d = mkdtempSync(join(tmpdir(), 'cto-state-'));
  mkdirSync(join(d, 'docs', 'cto', 'results'), { recursive: true });
  writeFileSync(join(d, 'docs', 'cto', 'gates.md'), MAP);
  return d;
};
const set = (d, row, st) => spawnSync(process.execPath, [SCRIPT, row, st], { cwd: d, encoding: 'utf8' });
const status = (d, row) => readFileSync(join(d, 'docs', 'cto', 'gates.md'), 'utf8').split('\n').find((l) => l.startsWith(`| ${row} |`)).split('|').slice(-2)[0].trim();

test('normal path: todo -> running -> pass changes exactly one row', () => {
  const d = project();
  assert.equal(set(d, 'G1', 'running').status, 0);
  writeFileSync(join(d, 'docs', 'cto', 'results', 'G1.json'), '{}');
  const r = set(d, 'G1', 'pass');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(status(d, 'G1'), 'pass');
  assert.equal(status(d, 'G2'), 'todo');
  assert.equal(status(d, 'REVIEW-1'), 'todo');
});

test('refuses running before dependencies pass, and pass without a result file', () => {
  const d = project();
  assert.notEqual(set(d, 'G2', 'running').status, 0);
  assert.equal(status(d, 'G2'), 'todo');
  set(d, 'G1', 'running');
  const r = set(d, 'G1', 'pass');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /results\/G1\.json/);
  assert.equal(status(d, 'G1'), 'running');
});

test('refuses illegal transitions and unknown rows; a row name inside another column never matches', () => {
  const d = project();
  assert.notEqual(set(d, 'G1', 'pass').status, 0);
  assert.notEqual(set(d, 'G9', 'running').status, 0);
  assert.notEqual(set(d, 'G1', 'done').status, 0);
  set(d, 'G1', 'running');
  writeFileSync(join(d, 'docs', 'cto', 'results', 'G1.json'), '{}');
  set(d, 'G1', 'pass');
  writeFileSync(join(d, 'docs', 'cto', 'results', 'G2.json'), '{}');
  set(d, 'G2', 'running'); set(d, 'G2', 'pass');
  assert.equal(set(d, 'REVIEW-1', 'running').status, 0);
  assert.equal(status(d, 'FINAL'), 'todo');
  assert.notEqual(set(d, 'G1', 'running').status, 0, 'pass is final');
});

test('fail and blocked can be re-run', () => {
  const d = project();
  set(d, 'G1', 'running');
  assert.equal(set(d, 'G1', 'fail').status, 0);
  assert.equal(set(d, 'G1', 'running').status, 0);
  assert.equal(set(d, 'G1', 'blocked').status, 0);
  assert.equal(set(d, 'G1', 'running').status, 0);
});
