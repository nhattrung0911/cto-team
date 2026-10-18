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
  assert.equal(m.version, '0.6.2');
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
  has(REF + 'verifier-prompt.md', ['assume the work is broken', 'git diff', 'full test suite', 'mutation', 'restore', 'git status', 'UNVERIFIED', 'Critical', 'Important', 'Minor', 'do not edit source', 'write the result path']);
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
test('lean plugin agents with role tool lists; the checker cannot edit', () => {
  const w = read('agents/worker.md'), c = read('agents/checker.md');
  assert.match(w, /^name: worker$/m);
  assert.match(w, /^tools: .*Edit/m);
  assert.match(c, /^name: checker$/m);
  assert.doesNotMatch(c, /^tools: .*\bEdit\b/m, 'checker must not edit');
  assert.match(c, /^tools: .*mcp__playwright/m);
});

test('v0.6: the CTO leads visible agents; the skill keeps two iron rules, guardrails with reasons and exact scripts', () => {
  const sk = read('skills/deliver/SKILL.md');
  has('skills/deliver/SKILL.md', [
    'two iron rules', 'fresh checker', 'cto-judge.mjs', 'real tests only', '| thought | reality |',    // discipline + rationalizations
    'why:', 'change the playbook freely', 'ruling:',                                                  // reasons, freedom
    'cto-team:worker', 'cto-team:checker', 'agent map', 'in the background', 'follow-up message',      // visible team, fix by its author first
    'shared resources run one at a time', 'its own port and', 'one owner per file',
    'docs/contract/', 'model: "opus"', 'REVIEW-<k>', 'GOAL#<n>', '--carried', 'GAPS', 'UNPROVEN:',
    '${CLAUDE_SKILL_DIR}', 'how many sonnet workers', 'progress line', 'checkpoint:', 'handoff:', '/compact', '500k',
    'git stash push -u', 'cto-state.mjs', 'clean as you go', 'watch the clock', 'exact test command yourself',"git rm` this gate's briefs",
  ]);
  assert.ok(!/Workflow tool|gate\.js/.test(sk), 'no gate workflow');
  const desc = sk.match(/\ndescription: (.*)/)[1];
  assert.match(desc, /^Use when/, 'description says when to use it');
  assert.ok(desc.length < 500 && !/verifier|workers/i.test(desc), 'description must not summarize the workflow');
  has(REF + 'worker-prompt.md', ['never start a build', 'more than 3 times', 'CONTRACT:', 'quiet output', 'work as a fixer']);
  has(REF + 'verifier-prompt.md', ['assume the work is broken', 'hash-object', 'never git checkout', 'suite.cmd', 'you run alone', 'overflow', '5xx']);
  has(REF + 'reviewer-prompt.md', ['reproduce', 'overflow', 'anti-goal', '"findings"']);
});
