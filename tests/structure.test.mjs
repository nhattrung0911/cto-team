import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const json = (p) => JSON.parse(read(p));

test('manifest has name, version, description, license MIT', () => {
  const m = json('.claude-plugin/plugin.json');
  assert.equal(m.name, 'cto-team');
  assert.equal(m.version, '0.4.2');
  assert.equal(m.license, 'MIT');
  assert.ok(m.description.length > 20);
  assert.equal(m.author.name, 'nhattrung0911');
});

test('marketplace lists the plugin at repo root', () => {
  const mk = json('.claude-plugin/marketplace.json');
  const m = json('.claude-plugin/plugin.json');
  assert.equal(mk.name, 'cto-team');
  assert.equal(mk.plugins.length, 1);
  assert.equal(mk.plugins[0].name, 'cto-team');
  assert.equal(mk.plugins[0].source, './');
  assert.equal(mk.plugins[0].version, m.version);
});

test('NOTICE credits both MIT sources', () => {
  const n = read('NOTICE');
  for (const s of ['obra/superpowers', 'olsenbrands/fable-foreman', 'MIT']) assert.ok(n.includes(s), s);
});

export { ROOT, read, json, existsSync };

const REF = 'skills/deliver/references/';
const has = (file, words) => {
  const t = read(file).toLowerCase();
  for (const w of words) assert.ok(t.includes(w.toLowerCase()), `${file} lacks "${w}"`);
};

test('brief template has the eight sections in order', () => {
  const t = read(REF + 'gate-brief.md');
  const heads = ['Goal', 'Files you may touch', 'Interfaces', 'Global constraints', 'Acceptance criteria', 'Break-prone cases', 'Commands', 'Out of scope'];
  let at = -1;
  for (const h of heads) {
    const i = t.indexOf(`## ${h}`);
    assert.ok(i > at, `heading "${h}" missing or out of order`);
    at = i;
  }
});

test('worker prompt states the contract', () => {
  has(REF + 'worker-prompt.md', ['DONE', 'DONE_WITH_CONCERNS', 'BLOCKED', 'FAILED', 'only your brief', 'real tests', 'delete temporary files', 'failing first']);
});

test('verifier prompt is blind and evidence-based', () => {
  has(REF + 'verifier-prompt.md', ['assume the work is broken', 'git diff', 'full test suite', 'mutation', 'restore', 'git status', 'UNVERIFIED', 'Critical', 'Important', 'Minor', 'do not edit source', 'write the full detail to']);
});

test('fixer prompt requires root cause', () => {
  has(REF + 'fixer-prompt.md', ['rootCause', 'root cause', 'evidence', 'no shotgun']);
});

test('test policy lists all break-prone categories', () => {
  has(REF + 'test-policy.md', ['boundar', 'empty', 'large', 'Unicode', 'malformed', 'permission', 'IDOR', 'concurren', 'time zone', 'rounding', 'network', 'idempoten', 'XSS', 'assert True', 'mock', '## Web', '## API', '## CLI', '## Data']);
});

const frontmatter = (file) => {
  const t = read(file);
  assert.ok(t.startsWith('---\n') || t.startsWith('---\r\n'), `${file} has no frontmatter`);
  const end = t.indexOf('\n---', 3);
  return { head: t.slice(0, end), lines: t.split(/\r?\n/).length, text: t };
};
const linksResolve = (skillDir) => {
  const t = read(`${skillDir}/SKILL.md`);
  const refs = [...t.matchAll(/\b((?:references|workflows)\/[\w.\-]+)/g)].map((m) => m[1]);
  assert.ok(refs.length > 0, 'no references found');
  for (const r of new Set(refs)) assert.ok(existsSync(join(ROOT, skillDir, r)), `${skillDir}/${r} missing`);
};

test('deliver frontmatter', () => {
  const f = frontmatter('skills/deliver/SKILL.md');
  assert.match(f.head, /\nname: deliver\b/);
  assert.match(f.head, /\ndescription: .*deliver/i);
  assert.match(f.head, /\ndescription: .*plan/i);
  assert.ok(f.lines < 180, `deliver SKILL.md has ${f.lines} lines`);
});

test('deliver links resolve', () => linksResolve('skills/deliver'));

test('deliver states the hard rules', () => {
  has('skills/deliver/SKILL.md', ['replaces', 'REQUIRED SUB-SKILL', 'at most `Workers` tasks', 'disjoint', 'never edit product code', 'SendMessage', 'Ruling:', 'scope', 'destructive', 'paid', 'secret', 'cto/', 'baseline', 'git stash', 'G0', 'Workflow', 'scriptPath', 'gates.md', 'ledger.md', 'report.html', '/clear']);
});

test('report template has every placeholder and a mermaid block', () => {
  const t = read(REF + 'report-template.html');
  for (const p of ['TITLE', 'SUMMARY', 'HOW_TO_TRY', 'WORKS', 'STACK_ROWS', 'MERMAID', 'GAPS', 'COST', 'LANG']) assert.ok(t.includes(`{{${p}}}`), p);
  assert.ok(t.includes('class="mermaid"'));
  assert.match(t, /cdn\.jsdelivr\.net\/npm\/mermaid@\d+\.\d+\.\d+/);
  assert.ok(t.includes('<html lang="{{LANG}}">'));
  assert.ok(t.includes('prefers-color-scheme: dark'));
});

const PREF = 'skills/plan/references/';

test('plan frontmatter', () => {
  const f = frontmatter('skills/plan/SKILL.md');
  assert.match(f.head, /\nname: plan\b/);
  assert.match(f.head, /\ndescription: .*superpowers/i);
  assert.ok(f.lines < 150, `plan SKILL.md has ${f.lines} lines`);
});

test('plan links resolve', () => linksResolve('skills/plan'));

test('plan skill interview rules', () => {
  has('skills/plan/SKILL.md', ['one question', 'play back', 'CTO call', 'default', '/clear', '/cto-team:deliver']);
});

test('plan template feeds deliver briefs', () => {
  const t = read(PREF + 'plan-template.md');
  for (const f of ['### Task 1:', '**Files:**', '**Interfaces:**', '**Acceptance criteria:**', '**Break-prone cases:**', '**Commands:**', '**Goal:**', '**Architecture:**', '**Tech Stack:**', '**Spec:**', '## Global Constraints']) assert.ok(t.includes(f), f);
  const brief = read(REF + 'gate-brief.md');
  const map = { 'Files you may touch': 'Files', Interfaces: 'Interfaces', 'Acceptance criteria': 'Acceptance criteria', 'Break-prone cases': 'Break-prone cases', Commands: 'Commands' };
  for (const [h, field] of Object.entries(map)) {
    assert.ok(brief.includes(`## ${h}`), `brief lacks ${h}`);
    assert.ok(t.includes(`**${field}:**`), `plan template lacks ${field}`);
  }
});

test('spec template sections', () => {
  has(PREF + 'spec-template.md', ['## Intent', '## Goals', '## Non-goals', '## Anti-goals', '## Constraints', '## Decided', '## CTO calls']);
});

test('plan review prompt', () => has(PREF + 'plan-review-prompt.md', ['guess', 'rank']));

test('README covers install, usage, settings', () => {
  has('README.md', ['/plugin marketplace add nhattrung0911/cto-team', '/plugin install cto-team@cto-team', '/cto-team:plan', '/cto-team:deliver', 'CLAUDE_CODE_AUTO_COMPACT_WINDOW', 'CLAUDE_CODE_SUBAGENT_MODEL', 'Playwright', 'superpowers']);
});

test('e2e checker rejects an empty folder', async () => {
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { spawnSync } = await import('node:child_process');
  const dir = mkdtempSync(join(tmpdir(), 'cto-e2e-'));
  const r = spawnSync(process.execPath, [join(ROOT, 'tests', 'e2e-check.mjs'), dir], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /gates\.md/);
});

test('review fixes: safe mutation restore, docs/cto ignored, stash -u, fix gate after FINAL', () => {
  has(REF + 'verifier-prompt.md', ['never git checkout', 'hash-object', 'MAIN:', 'docs/cto/']);
  has(REF + 'test-policy.md', ['never git checkout', 'hash-object']);
  assert.ok(!/confirm `?git diff`? (is )?clean/i.test(read(REF + 'test-policy.md')), 'test-policy still says git diff clean');
  has('skills/deliver/SKILL.md', ['stash push -u', 'fix gate', '"files"']);
  has(REF + 'fixer-prompt.md', ['new dependencies']);
});

test('deliver copies gate.js into the project (Workflow only accepts readable script paths)', () => {
  has('skills/deliver/SKILL.md', ['docs/cto/gate.js']);
});

test('v0.2: review step and large-number rule', () => {
  has(REF + 'reviewer-prompt.md', ['reproduce', 'overflow', '500', 'Critical', 'Important', 'Minor', 'anti-goal']);
  has(REF + 'test-policy.md', ['overflow', 'never 500']);
  has(REF + 'verifier-prompt.md', ['overflow', '5xx']);
  has(REF + 'gate-brief.md', ['overflow']);
  has('skills/deliver/SKILL.md', ['"mode": "review"', 'branchBase']);
});

test('v0.3: contract-first, ownership check, coverage, evidence rule, CEO questions', () => {
  has('skills/deliver/SKILL.md', ['docs/contract/', 'CONTRACT:', 'ownership check', 'Goals', 'coverage', 'UNPROVEN:', 'batch bookkeeping']);
  has(REF + 'gate-brief.md', ['contract']);
  has(REF + 'worker-prompt.md', ['CONTRACT:', 'never edit the contract']);
  has(REF + 'verifier-prompt.md', ['contract', 'no evidence']);
  has(REF + 'reviewer-prompt.md', ['contract']);
  has('skills/plan/SKILL.md', ['at most 5', 'recommended', 'Clarifications', 'contract']);
  has('skills/plan/references/spec-template.md', ['## Clarifications', '## Contract']);
});

test('v0.4: team size question, user test in FINAL, rg hook documented', () => {
  has('skills/deliver/SKILL.md', ['how many sonnet workers', 'maxWorkers', 'unattended', '"userTest": true', 'user-tester-prompt.md']);
  has(REF + 'user-tester-prompt.md', ['non-technical user', '375px', 'raw JSON', 'evidence']);
  has('README.md', ['ripgrep', 'workers per gate']);
});

test('v0.4: batch reviews, checkpoints, no polish gates after review', () => {
  has('skills/deliver/SKILL.md', ['REVIEW-<k>', 'every 3–4 passed gates', 'Checkpoint:', '/clear', 'only for a Critical finding']);
  has(REF + 'reviewer-prompt.md', ['batch of gates']);
});

test('v0.4: lean plugin agents with role tool lists', () => {
  const w = read('agents/worker.md'), c = read('agents/checker.md');
  assert.match(w, /^name: worker$/m);
  assert.match(w, /^tools: .*Edit/m);
  assert.match(c, /^name: checker$/m);
  assert.doesNotMatch(c, /^tools: .*\bEdit\b/m, 'checker must not edit');
  assert.match(c, /^tools: .*mcp__playwright/m);
  has('skills/deliver/SKILL.md', ['"lean": false']);
  has('README.md', ['lean agents']);
});

test('v0.4 Codex fixes are documented', () => {
  has('skills/deliver/SKILL.md', ['git diff --name-only <gate_base>', 'git ls-files --others --exclude-standard', 'docs(contract):', 'Stash:', '"criteria": 4', 'Ruling: <criterion> not a failure', 'REVIEW-<k>` and for `FINAL`']);
  has(REF + 'verifier-prompt.md', ['git hash-object <file>', 'never null', '`suite`', 'G1-T1'.slice(0, 0) + '<task id>#<number in the brief>']);
  has(REF + 'worker-prompt.md', ['quiet output']);
  has('README.md', ['not a security boundary', '2.1.301']);
});

test('e2e checker requires FINAL and REVIEW PASS lines', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { spawnSync } = await import('node:child_process');
  const dir = mkdtempSync(join(tmpdir(), 'cto-e2e-'));
  const c = join(dir, 'docs', 'cto');
  mkdirSync(join(c, 'results'), { recursive: true });
  writeFileSync(join(c, 'gates.md'), '| Gate | Tasks | Status |\n|---|---|---|\n| G1 | T1 | pass |\n');
  writeFileSync(join(c, 'results', 'G1.json'), '{}');
  writeFileSync(join(c, 'results', 'FINAL.json'), '{}');
  writeFileSync(join(c, 'ledger.md'), 'G1 PASS rounds=0\nFINAL FAIL rounds=2\n');
  writeFileSync(join(c, 'report.html'), '<html></html>');
  const r = spawnSync(process.execPath, [join(ROOT, 'tests', 'e2e-check.mjs'), dir], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /FINAL/);
});

test('e2e checker: conforming project passes; any non-pass row or missing stage file fails', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { spawnSync, execFileSync } = await import('node:child_process');
  const make = (rows, files) => {
    const dir = mkdtempSync(join(tmpdir(), 'cto-e2e-ok-'));
    const c = join(dir, 'docs', 'cto');
    mkdirSync(join(c, 'results'), { recursive: true });
    writeFileSync(join(c, 'gates.md'), `Workers: 3 | Test: node -e "process.exit(0)" | App: none | Contract: none\n| Gate | Tasks | Depends on | Status |\n|---|---|---|---|\n${rows}`);
    for (const f of files) writeFileSync(join(c, 'results', f), '{}');
    writeFileSync(join(c, 'ledger.md'), 'G1 PASS rounds=0\nREVIEW-1 PASS rounds=1\nFINAL PASS rounds=0\n');
    writeFileSync(join(c, 'report.html'), '<html></html>');
    const g = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
    g('init', '-q'); g('checkout', '-q', '-b', 'cto/x'); g('add', '-A');
    g('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'x');
    return spawnSync(process.execPath, [join(ROOT, 'tests', 'e2e-check.mjs'), dir], { encoding: 'utf8' });
  };
  const good = '| G1 | T1 | - | pass |\n| REVIEW-1 | - | G1 | pass |\n| FINAL | - | REVIEW-1 | pass |\n';
  const ok = make(good, ['G1.json', 'REVIEW-1.review.json', 'FINAL.json']);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  const blockedReview = make(good.replace('| REVIEW-1 | - | G1 | pass |', '| REVIEW-1 | - | G1 | blocked |'), ['G1.json', 'REVIEW-1.review.json', 'FINAL.json']);
  assert.equal(blockedReview.status, 1);
  assert.match(blockedReview.stdout, /REVIEW-1/);
  const noReviewFile = make(good, ['G1.json', 'FINAL.json']);
  assert.equal(noReviewFile.status, 1);
});

test('round 2 docs: state script, FINAL goals, fix gate after FINAL gets a review, honest cost, checker wording', () => {
  has('skills/deliver/SKILL.md', ['docs/cto/cto-state.mjs', 'never edit the Status column', '"goals"', 'its own `REVIEW-<k>`', 'never estimate tokens', 'only after the Workflow result']);
  has('README.md', ['instruction boundary']);
  assert.ok(!read('README.md').includes('Checkers cannot edit files'));
});

test('v0.4.1: workers skip timing tests and run the full suite once; the verifier runs them alone', () => {
  has(REF + 'worker-prompt.md', ['timing-sensitive', 'once at the end']);
  has(REF + 'fixer-prompt.md', ['once']);
  has(REF + 'verifier-prompt.md', ['timing-sensitive', 'alone']);
  has(REF + 'gate-brief.md', ['Timing-sensitive tests']);
});

test('v0.4.2: deliver offers a direct path or small mode for small jobs, and reports progress per gate', () => {
  has('skills/deliver/SKILL.md', ['small job', 'small mode', 'direct', '"goals"', 'progress line']);
});
