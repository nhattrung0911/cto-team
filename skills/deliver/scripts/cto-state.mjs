#!/usr/bin/env node
// cto-team gate map updater. Run from the project root: node docs/cto/cto-state.mjs <row> <status>
// Changes the Status cell of exactly one row in docs/cto/gates.md, and only along legal transitions:
//   todo|fail|blocked -> running   (every row in "Depends on" must already be pass)
//   running -> pass|fail|blocked   (pass needs docs/cto/results/<row>.json or <row>.<stage>.json)
// Exit 0 and one line on success; exit 1 and a reason on stderr otherwise. The file is untouched on refusal.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [row, next] = process.argv.slice(2);
const MAP = join('docs', 'cto', 'gates.md');
const STATES = ['todo', 'running', 'pass', 'fail', 'blocked'];
const NEXT = { todo: ['running'], fail: ['running'], blocked: ['running'], running: ['pass', 'fail', 'blocked'], pass: [] };

const die = (msg) => {
  process.stderr.write(`cto-state: ${msg}\n`);
  process.exit(1);
};

if (!row || !next) die('usage: node docs/cto/cto-state.mjs <row> <todo|running|pass|fail|blocked>');
if (!STATES.includes(next)) die(`unknown status "${next}"`);
if (!existsSync(MAP)) die(`${MAP} not found (run from the project root)`);

const lines = readFileSync(MAP, 'utf8').split('\n');
const cells = (l) => l.split('|').slice(1, -1).map((c) => c.trim());
const header = lines.findIndex((l) => /^\|/.test(l) && cells(l).includes('Status'));
if (header < 0) die('no table header with a Status column');
const head = cells(lines[header]);
const col = { status: head.indexOf('Status'), deps: head.indexOf('Depends on') };
const rows = new Map();
for (let i = header + 1; i < lines.length && /^\|/.test(lines[i]); i++) {
  const c = cells(lines[i]);
  if (/^-+$/.test(c[0])) continue;
  rows.set(c[0], { i, c });
}

const r = rows.get(row);
if (!r) die(`no row "${row}" in ${MAP}`);
const now = r.c[col.status];
if (!(NEXT[now] || []).includes(next)) die(`${row}: ${now} -> ${next} is not allowed`);
if (next === 'running' && col.deps >= 0) {
  for (const d of r.c[col.deps].split(/[\s,;]+/).filter((x) => x && x !== '-')) {
    const dep = rows.get(d);
    if (!dep) die(`${row} depends on unknown row ${d}`);
    if (dep.c[col.status] !== 'pass') die(`${row} depends on ${d}, which is ${dep.c[col.status]}`);
  }
}
// Stage files: <row>.json, <row>.r1.json, <row>.review.json, <row>.user.json (written by the verifier, reviewer and user tester).
const RESULTS = join('docs', 'cto', 'results');
const isResult = (f) => {
  const name = f.toLowerCase();
  const base = row.toLowerCase();
  if (name === `${base}.json`) return true;
  if (!name.startsWith(`${base}.`) || !name.endsWith('.json')) return false;
  const stage = name.slice(base.length + 1, -'.json'.length);
  return /^[a-z0-9]+$/.test(stage);
};
const hasResult = existsSync(RESULTS) && readdirSync(RESULTS).some(isResult);
if (next === 'pass' && !hasResult) {
  die(`${row}: no docs/cto/results/${row}.json (or ${row}.<stage>.json); a row passes only with its result file`);
}

r.c[col.status] = next;
lines[r.i] = `| ${r.c.join(' | ')} |`;
writeFileSync(MAP, lines.join('\n'));
process.stdout.write(`${row}: ${now} -> ${next}\n`);
