#!/usr/bin/env node
// Checks a project delivered by /cto-team:deliver. Usage: node tests/e2e-check.mjs "<project path>"
// Exit 0 + "E2E OK" when every check passes; exit 1 with the failed checks otherwise.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const root = process.argv[2];
const fails = [];
const fail = (m) => fails.push(m);
const cto = (p) => join(root, 'docs', 'cto', p);
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();

if (!root || !existsSync(root)) {
  console.log(`usage: e2e-check.mjs <project path> (got ${root})`);
  process.exit(1);
}

// git
let isRepo = true;
try { git('rev-parse', '--git-dir'); } catch { isRepo = false; fail('not a git repository'); }
if (isRepo) {
  const branches = git('branch', '--list', 'cto/*');
  if (!branches) fail('no cto/* branch');
  const dirty = git('status', '--porcelain');
  if (dirty) fail(`working tree not clean:\n${dirty}`);
}

// gates.md
let gates = [];
let testCmd = null;
if (!existsSync(cto('gates.md'))) fail('docs/cto/gates.md missing');
else {
  const t = readFileSync(cto('gates.md'), 'utf8');
  const m = t.match(/(?:^|\|)\s*Test:\s*(.+?)\s*(?:\||$)/m);
  testCmd = m ? m[1] : null;
  if (!testCmd) fail('gates.md has no "Test: <cmd> |" header line');
  for (const line of t.split(/\r?\n/)) {
    const cells = line.split('|').map((c) => c.trim());
    if (!/^(G\d+|REVIEW(-\d+)?|FINAL)$/.test(cells[1] || '')) continue;
    const status = cells[cells.length - 2];
    gates.push({ id: cells[1], status });
    if (/^(todo|running)$/i.test(status)) fail(`${cells[1]} status is ${status}`);
    if (/^(fail|blocked)$/i.test(status)) fail(`${cells[1]} ended ${status}`);
  }
  if (!gates.some((g) => /^G\d+$/.test(g.id))) fail('gates.md has no gate rows');
  if (!gates.some((g) => g.id === 'FINAL')) fail('gates.md has no FINAL row');
  if (!gates.some((g) => /^REVIEW/.test(g.id))) fail('gates.md has no REVIEW row');
}

// results + ledger
const ledger = existsSync(cto('ledger.md')) ? readFileSync(cto('ledger.md'), 'utf8') : (fail('docs/cto/ledger.md missing'), '');
// Stage files: <row>.json, <row>.r1.json, <row>.review.json, <row>.user.json.
const results = existsSync(cto('results')) ? readdirSync(cto('results')).map((f) => f.toLowerCase()) : [];
const hasResult = (id) => results.some((f) => f === `${id}.json` || (f.startsWith(`${id}.`) && /^[a-z0-9]+\.json$/.test(f.slice(id.length + 1))));
for (const g of gates) {
  if (!hasResult(g.id.toLowerCase())) fail(`results/${g.id}.json (or ${g.id}.<stage>.json) missing`);
  if (!new RegExp(`^.*\\b${g.id}\\b.*PASS`, 'm').test(ledger)) fail(`ledger has no PASS line for ${g.id}`);
}

// report
if (!existsSync(cto('report.html'))) fail('docs/cto/report.html missing');
else if (readFileSync(cto('report.html'), 'utf8').includes('{{')) fail('report.html still has {{placeholders}}');

// project tests
if (testCmd) {
  const r = spawnSync(testCmd, { cwd: root, shell: true, encoding: 'utf8' });
  if (r.status !== 0) fail(`test command failed (${testCmd}):\n${(r.stdout + r.stderr).split('\n').slice(-8).join('\n')}`);
}

if (fails.length) {
  console.log('E2E FAILED');
  for (const f of fails) console.log(`- ${f}`);
  process.exit(1);
}
console.log(`E2E OK (${gates.length} gates)`);
