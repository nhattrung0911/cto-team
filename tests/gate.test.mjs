import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runGate } from './harness.mjs';

const ROOT = 'D:\\AI\\My Project';
const baseArgs = (over = {}) => ({
  gate: 'G2',
  gateBase: 'abc1234',
  projectRoot: ROOT,
  refs: 'C:\\plugins\\cto-team\\skills\\deliver\\references',
  tasks: [
    { id: 'G2-T1', brief: 'docs/cto/briefs/G2-T1.md', files: ['app/money.py', 'tests/test_money.py'], criteria: 1 },
    { id: 'G2-T2', brief: 'docs/cto/briefs/G2-T2.md', files: ['app/auth.py', 'tests/test_auth.py'], criteria: 1 },
  ],
  testCmd: 'pytest -q',
  appStart: null,
  critical: true,
  resultPath: 'docs/cto/results/G2.json',
  ...over,
});

const done = (over = {}) => ({ status: 'DONE', files: ['app/x.py'], tests: [{ cmd: 'pytest -q tests/test_x.py', result: 'WORKER-SAYS-3-PASSED' }], concerns: [], ...over });
const pass = (over = {}) => ({
  verdict: 'PASS',
  criteria: [
    { id: 'G2-T1#1', criterion: 'splits 100000 into 3 exact parts', pass: true, severity: 'Critical', evidence: 'pytest: 1 passed' },
    { id: 'G2-T2#1', criterion: 'login rejects a wrong password', pass: true, severity: 'Critical', evidence: 'POST /login -> 401' },
    { id: 'GOAL#1', criterion: 'main flow works end to end', pass: true, severity: 'Critical', evidence: 'uvicorn flow: 200s' },
  ],
  mutation: { checked: true, caught: true, restored: true },
  suite: { cmd: 'pytest -q', exit: 0, summary: '42 passed' },
  junk: [],
  uiUnverified: [],
  ...over,
});
const fail = (over = {}) => pass({
  verdict: 'FAIL',
  criteria: [{ criterion: 'rejects non-member reading group', pass: false, severity: 'Important', evidence: 'GET /groups/2 returned 200' }],
  ...over,
});
const fixed = () => ({ ...done(), rootCause: 'missing membership check in get_group' });
const byRole = (calls, role) => calls.filter((c) => c.role === role);

test('runs one worker per task in parallel with its brief path', async () => {
  const { calls } = await runGate(baseArgs(), { worker: () => done(), verifier: () => pass() });
  const w = byRole(calls, 'worker');
  assert.equal(w.length, 2);
  assert.ok(w[0].prompt.includes('G2-T1.md') && !w[0].prompt.includes('G2-T2.md'));
  assert.ok(w[1].prompt.includes('G2-T2.md') && !w[1].prompt.includes('G2-T1.md'));
  for (const c of w) {
    assert.equal(c.opts.model, 'sonnet');
    assert.ok(c.opts.schema);
  }
});

test('rejects more than 3 tasks', async () => {
  const tasks = [1, 2, 3, 4].map((n) => ({ id: `G2-T${n}`, brief: `docs/cto/briefs/G2-T${n}.md` }));
  await assert.rejects(runGate(baseArgs({ tasks }), { worker: () => done(), verifier: () => pass() }), /max 3/);
});

test('pass first time', async () => {
  const { result, calls } = await runGate(baseArgs(), { worker: () => done(), verifier: () => pass() });
  assert.equal(result.verdict, 'PASS');
  assert.equal(result.rounds, 0);
  assert.equal(byRole(calls, 'fixer').length, 0);
  assert.equal(result.resultPath, 'docs/cto/results/G2.json');
});

test('fail then pass uses one fixer', async () => {
  const { result, calls } = await runGate(baseArgs(), {
    worker: () => done(),
    verifier: (_p, _o, n) => (n === 1 ? fail() : pass()),
    fixer: () => fixed(),
  });
  assert.equal(result.verdict, 'PASS');
  assert.equal(result.rounds, 1);
  const f = byRole(calls, 'fixer');
  assert.equal(f.length, 1);
  assert.ok(f[0].prompt.includes('rejects non-member reading group'));
  assert.ok(f[0].prompt.includes('rootCause'));
  assert.equal(f[0].opts.model, 'sonnet');
});

test('stops after two fix rounds', async () => {
  const { result, calls } = await runGate(baseArgs(), { worker: () => done(), verifier: () => fail(), fixer: () => fixed() });
  assert.equal(result.verdict, 'FAIL');
  assert.equal(result.rounds, 2);
  assert.equal(byRole(calls, 'fixer').length, 2);
  assert.equal(byRole(calls, 'verifier').length, 3);
  assert.ok(result.failing.length > 0);
  assert.equal(result.failing[0].severity, 'Important');
});

test('blocked worker skips verify', async () => {
  const { result, calls } = await runGate(baseArgs(), {
    worker: (p) => (p.includes('G2-T2') ? done({ status: 'BLOCKED', concerns: ['needs API key'] }) : done()),
    verifier: () => pass(),
  });
  assert.equal(result.verdict, 'BLOCKED');
  assert.equal(byRole(calls, 'verifier').length, 0);
  assert.ok(result.blockers.some((b) => b.includes('needs API key')));
});

test('null worker blocks even if verifier would pass', async () => {
  const { result, calls } = await runGate(baseArgs(), {
    worker: (p) => (p.includes('G2-T2') ? null : done()),
    verifier: () => pass(),
  });
  assert.equal(result.verdict, 'BLOCKED');
  assert.equal(byRole(calls, 'verifier').length, 0);
  assert.ok(result.blockers.some((c) => c.includes('G2-T2')));
});

test('rejects tasks that share files or ids', async () => {
  const s = { worker: () => done(), verifier: () => pass() };
  const shared = baseArgs({ tasks: [
    { id: 'G2-T1', brief: 'docs/cto/briefs/G2-T1.md', files: ['app/x.py'], criteria: 1 },
    { id: 'G2-T2', brief: 'docs/cto/briefs/G2-T2.md', files: ['app\\x.py'], criteria: 1 },
  ] });
  await assert.rejects(runGate(shared, s), /share file/);
  const dupId = baseArgs({ tasks: [
    { id: 'G2-T1', brief: 'docs/cto/briefs/G2-T1.md', files: ['a.py'], criteria: 1 },
    { id: 'G2-T1', brief: 'docs/cto/briefs/G2-T9.md', files: ['b.py'], criteria: 1 },
  ] });
  await assert.rejects(runGate(dupId, s), /duplicate/);
  const noFiles = baseArgs({ tasks: [{ id: 'G2-T1', brief: 'docs/cto/briefs/G2-T1.md' }] });
  await assert.rejects(runGate(noFiles, s), /files/);
});

test('mutation not caught fails the gate', async () => {
  const { result, calls } = await runGate(baseArgs(), {
    worker: () => done(),
    verifier: () => pass({ mutation: { checked: true, caught: false, restored: true } }),
    fixer: () => fixed(),
  });
  assert.equal(result.verdict, 'FAIL');
  assert.ok(byRole(calls, 'fixer')[0].prompt.includes('do not catch'));
});

test('critical gate without a completed mutation check is blocked', async () => {
  for (const mutation of [{ checked: false, caught: null, restored: null }, { checked: true, caught: true, restored: null }]) {
    const { result } = await runGate(baseArgs({ critical: true }), { worker: () => done(), verifier: () => pass({ mutation }) });
    assert.equal(result.verdict, 'BLOCKED', JSON.stringify(mutation));
  }
  const off = await runGate(baseArgs({ critical: false }), {
    worker: () => done(), verifier: () => pass({ mutation: { checked: false, caught: null, restored: null } }),
  });
  assert.equal(off.result.verdict, 'PASS');
});

test('empty criteria fail the gate', async () => {
  const { calls } = await runGate(baseArgs(), {
    worker: () => done(), verifier: (_p, _o, n) => (n === 1 ? pass({ criteria: [] }) : pass()), fixer: () => fixed(),
  });
  assert.equal(byRole(calls, 'fixer').length, 1);
});

test('unverifiable main flow blocks; other unverified items do not reach fixers', async () => {
  const main = await runGate(baseArgs(), {
    worker: () => done(), verifier: () => pass({ uiUnverified: ['MAIN: login page works on phone'] }), fixer: () => fixed(),
  });
  assert.equal(main.result.verdict, 'BLOCKED');
  assert.equal(byRole(main.calls, 'fixer').length, 0);
  const side = await runGate(baseArgs(), {
    worker: () => done(),
    verifier: (_p, _o, n) => (n === 1 ? fail({ uiUnverified: ['settings page dark mode'] }) : pass({ uiUnverified: ['settings page dark mode'] })),
    fixer: () => fixed(),
  });
  assert.equal(side.result.verdict, 'PASS');
  assert.ok(!byRole(side.calls, 'fixer')[0].prompt.includes('settings page dark mode'));
  assert.ok(side.result.concerns.some((c) => c.includes('settings page dark mode')));
});

test('mutation instructions never restore with git checkout', async () => {
  const { calls } = await runGate(baseArgs({ critical: true }), { worker: () => done(), verifier: () => pass() });
  const v = byRole(calls, 'verifier')[0].prompt;
  assert.ok(v.includes('never git checkout'));
  assert.ok(v.includes('hash-object'));
  assert.ok(v.includes('docs/cto/'));
});

test('null verifier', async () => {
  const { result } = await runGate(baseArgs(), { worker: () => done(), verifier: () => null });
  assert.equal(result.verdict, 'BLOCKED');
});

test('script overrides lenient verifier', async () => {
  const lenient = pass({ criteria: [{ criterion: 'password is hashed', pass: false, severity: 'Critical', evidence: 'plaintext in db' }] });
  const a = await runGate(baseArgs(), { worker: () => done(), verifier: (_p, _o, n) => (n === 1 ? lenient : pass()), fixer: () => fixed() });
  assert.equal(byRole(a.calls, 'fixer').length, 1);
  const junky = pass({ junk: ['debug.log'] });
  const b = await runGate(baseArgs(), { worker: () => done(), verifier: (_p, _o, n) => (n === 1 ? junky : pass()), fixer: () => fixed() });
  assert.equal(byRole(b.calls, 'fixer').length, 1);
  assert.ok(byRole(b.calls, 'fixer')[0].prompt.includes('debug.log'));
});

test('minor failures do not block', async () => {
  const minorOnly = pass({ criteria: [
    ...pass().criteria,
    { criterion: 'button label capitalised', pass: false, severity: 'Minor', evidence: 'label is "save"' },
  ] });
  const { result, calls } = await runGate(baseArgs(), { worker: () => done(), verifier: () => minorOnly });
  assert.equal(result.verdict, 'PASS');
  assert.equal(result.minor.length, 1);
  assert.equal(byRole(calls, 'fixer').length, 0);
});

test('unrestored mutation blocks', async () => {
  const { result, calls } = await runGate(baseArgs(), {
    worker: () => done(),
    verifier: () => pass({ mutation: { checked: true, caught: true, restored: false } }),
  });
  assert.equal(result.verdict, 'BLOCKED');
  assert.equal(byRole(calls, 'fixer').length, 0);
});

test('verifier is blind', async () => {
  const { calls } = await runGate(baseArgs(), {
    worker: () => done({ concerns: ['WORKER-CONCERN-xyz'] }),
    verifier: () => pass(),
  });
  const v = byRole(calls, 'verifier')[0].prompt;
  assert.ok(!v.includes('WORKER-CONCERN-xyz'));
  assert.ok(!v.includes('WORKER-SAYS-3-PASSED'));
  assert.ok(v.includes('abc1234'));
  assert.ok(v.includes('docs/cto/results/G2.json'));
});

test('mutation only when critical', async () => {
  const on = await runGate(baseArgs({ critical: true }), { worker: () => done(), verifier: () => pass() });
  assert.ok(byRole(on.calls, 'verifier')[0].prompt.includes('Run the mutation check'));
  const off = await runGate(baseArgs({ critical: false }), { worker: () => done(), verifier: () => pass() });
  assert.ok(byRole(off.calls, 'verifier')[0].prompt.includes('Skip the mutation check'));
});

test('final mode verifies without workers', async () => {
  const finalBriefs = ['G1-T1', 'G1-T2', 'G2-T1', 'G3-T1'].map((t) => `docs/cto/briefs/${t}.md`);
  const { calls } = await runGate(baseArgs({ gate: 'FINAL', mode: 'final', tasks: [], finalBriefs, branchBase: 'f4449b5', goals: 1 }), { verifier: () => pass() });
  assert.equal(byRole(calls, 'worker').length, 0);
  const v = byRole(calls, 'verifier')[0].prompt;
  for (const b of finalBriefs) assert.ok(v.includes(b.split('/').pop()), b);
  await assert.rejects(runGate(baseArgs({ tasks: [] }), { verifier: () => pass() }), /at least 1 task/);
});

test('quotes paths with spaces', async () => {
  const { calls } = await runGate(baseArgs(), { worker: () => done(), verifier: (_p, _o, n) => (n === 1 ? fail() : pass()), fixer: () => fixed() });
  for (const c of calls) assert.ok(c.prompt.includes(`"${ROOT}"`), `${c.role} prompt lacks quoted root`);
});

test('posix paths keep forward slashes', async () => {
  const args = baseArgs({ projectRoot: '/home/ceo/my app', refs: '/home/ceo/.claude/plugins/cto-team/skills/deliver/references' });
  const { calls } = await runGate(args, { worker: () => done(), verifier: () => pass() });
  const w = byRole(calls, 'worker')[0].prompt;
  assert.ok(w.includes('"/home/ceo/my app/docs/cto/briefs/G2-T1.md"'), w);
  assert.ok(w.includes('"/home/ceo/.claude/plugins/cto-team/skills/deliver/references/worker-prompt.md"'));
  assert.ok(!w.includes(String.fromCharCode(92)), 'no backslash in posix prompt');
});

const reviewArgs = (over = {}) => baseArgs({ gate: 'REVIEW', mode: 'review', tasks: [], branchBase: 'f4449b5',
  finalBriefs: ['docs/cto/briefs/G1-T1.md', 'docs/cto/briefs/G2-T1.md'], resultPath: 'docs/cto/results/REVIEW.json', ...over });
const finding = (severity, issue) => ({ severity, file: 'app/api.py:42', issue, evidence: 'POST amount=1e20 → 500', fix: 'validate range' });

test('review mode: one reviewer on opus, no workers', async () => {
  const { result, calls } = await runGate(reviewArgs(), { reviewer: () => ({ findings: [finding('Minor', 'label casing')] }) });
  assert.equal(byRole(calls, 'worker').length, 0);
  const r = byRole(calls, 'reviewer');
  assert.equal(r.length, 1);
  assert.equal(r[0].opts.model, 'opus');
  assert.ok(r[0].opts.schema);
  assert.ok(r[0].prompt.includes('f4449b5'));
  assert.equal(result.verdict, 'PASS');
  assert.equal(result.minor.length, 1);
  assert.equal(byRole(calls, 'fixer').length, 0);
});

test('review mode: blocking findings go to a fixer, then a verifier', async () => {
  const { result, calls } = await runGate(reviewArgs(), {
    reviewer: () => ({ findings: [finding('Important', 'huge amount returns 500')] }),
    fixer: () => fixed(),
    verifier: () => pass({ criteria: [...pass().criteria, F('F1')] }),
  });
  const f = byRole(calls, 'fixer');
  assert.equal(f.length, 1);
  assert.ok(f[0].prompt.includes('huge amount returns 500'));
  const v = byRole(calls, 'verifier');
  assert.equal(v.length, 1);
  assert.ok(v[0].prompt.includes('huge amount returns 500'));
  assert.equal(result.verdict, 'PASS');
  assert.equal(result.rounds, 1);
});

test('review mode: needs branchBase and briefs', async () => {
  await assert.rejects(runGate(reviewArgs({ branchBase: undefined }), { reviewer: () => ({ findings: [] }) }), /branchBase/);
});

test('review mode: null reviewer blocks', async () => {
  const { result } = await runGate(reviewArgs(), { reviewer: () => null });
  assert.equal(result.verdict, 'BLOCKED');
});

// v0.3
test('v0.3: tasks may not own a contract file', async () => {
  const tasks = [{ id: 'G2-T1', brief: 'docs/cto/briefs/G2-T1.md', files: ['app/api.py', 'Docs/Contract/openapi.yaml'], criteria: 1 }];
  await assert.rejects(
    runGate(baseArgs({ tasks, contract: ['docs/contract/openapi.yaml'] }), { worker: () => done(), verifier: () => pass() }),
    /contract/,
  );
});

test('v0.3: workers and verifier are told the contract is read-only and checked', async () => {
  const { calls } = await runGate(baseArgs({ contract: ['docs/contract/openapi.yaml'] }), { worker: () => done(), verifier: () => pass() });
  for (const c of [...byRole(calls, 'worker'), ...byRole(calls, 'verifier')]) assert.ok(c.prompt.includes('docs/contract/openapi.yaml'));
  assert.ok(byRole(calls, 'worker')[0].prompt.includes('CONTRACT:'));
  assert.ok(/conform/i.test(byRole(calls, 'verifier')[0].prompt));
});

test('v0.3: the last fix round runs on opus, earlier rounds on sonnet', async () => {
  const { calls } = await runGate(baseArgs(), { worker: () => done(), verifier: () => fail(), fixer: () => fixed() });
  const f = byRole(calls, 'fixer');
  assert.deepEqual(f.map((c) => c.opts.model), ['sonnet', 'opus']);
});

test('v0.4: a failing Important criterion without evidence is not sent to fixers and blocks for the CTO', async () => {
  const unproven = fail({ criteria: [
    { criterion: 'splits exact', pass: true, severity: 'Critical', evidence: 'pytest: 1 passed' },
    { criterion: 'vague worry about naming', pass: false, severity: 'Important', evidence: ' ' },
  ] });
  const { result, calls } = await runGate(baseArgs(), { worker: () => done(), verifier: () => unproven, fixer: () => fixed() });
  assert.equal(byRole(calls, 'fixer').length, 0);
  assert.equal(result.verdict, 'BLOCKED');
  assert.ok(result.blockers.some((c) => c.startsWith('UNPROVEN:') && c.includes('vague worry')));
});

test('v0.3: a failing Critical criterion without evidence blocks for the CTO', async () => {
  const unproven = fail({ criteria: [{ criterion: 'maybe IDOR on groups', pass: false, severity: 'Critical', evidence: '' }] });
  const { result, calls } = await runGate(baseArgs(), { worker: () => done(), verifier: () => unproven, fixer: () => fixed() });
  assert.equal(byRole(calls, 'fixer').length, 0);
  assert.equal(result.verdict, 'BLOCKED');
  assert.ok(result.blockers.some((b) => b.includes('maybe IDOR')));
});

test('v0.3: review findings without evidence become minor', async () => {
  const { result, calls } = await runGate(reviewArgs(), { reviewer: () => ({ findings: [{ ...finding('Important', 'feels slow'), evidence: '' }] }) });
  assert.equal(byRole(calls, 'fixer').length, 0);
  assert.equal(result.verdict, 'PASS');
  assert.ok(result.minor.some((m) => m.criterion.includes('feels slow')));
});

// v0.4
test('v0.4: maxWorkers raises the per-gate task cap, default stays 3, hard cap 5', async () => {
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: `G2-T${i + 1}`, brief: `docs/cto/briefs/G2-T${i + 1}.md`, files: [`app/m${i}.py`], criteria: 1 }));
  const s = { worker: () => done(), verifier: () => pass(), fixer: () => fixed() };
  await assert.rejects(runGate(baseArgs({ tasks: mk(4) }), s), /max 3/);
  const { calls } = await runGate(baseArgs({ tasks: mk(5), maxWorkers: 5 }), s);
  assert.equal(byRole(calls, 'worker').length, 5);
  await assert.rejects(runGate(baseArgs({ tasks: mk(6), maxWorkers: 9 }), s), /max 5/);
  await assert.rejects(runGate(baseArgs({ tasks: mk(2), maxWorkers: 1 }), s), /max 1/);
});

const finalArgs = (over = {}) => baseArgs({ gate: 'FINAL', mode: 'final', tasks: [], finalBriefs: ['docs/cto/briefs/G1-T1.md'], branchBase: 'f4449b5', goals: 1, resultPath: 'docs/cto/results/FINAL.json', ...over });
const uxFinding = (severity, issue, evidence = 'clicked Save, page showed raw JSON') => ({ severity, file: 'app/templates/group.html', issue, evidence, fix: 'show a friendly error' });

test('v0.4: FINAL with userTest runs a fresh user tester after the verifier passes', async () => {
  const { result, calls } = await runGate(finalArgs({ userTest: true, appStart: 'uvicorn app.main:app' }), {
    verifier: () => pass(), user: () => ({ findings: [uxFinding('Minor', 'button label unclear')] }),
  });
  const u = byRole(calls, 'user');
  assert.equal(u.length, 1);
  assert.equal(u[0].opts.model, 'sonnet');
  assert.ok(u[0].prompt.includes('user-tester-prompt.md'));
  assert.equal(result.verdict, 'PASS');
  assert.ok(result.minor.some((m) => m.criterion.includes('button label unclear')));
});

test('v0.4: proven user-tester problems go to a fixer, unproven ones do not', async () => {
  const { result, calls } = await runGate(finalArgs({ userTest: true, appStart: 'uvicorn app.main:app' }), {
    verifier: (_p, _o, n) => (n === 1 ? pass() : pass({ criteria: [...pass().criteria, F('U1')] })),
    user: () => ({ findings: [uxFinding('Important', 'error shows raw JSON'), uxFinding('Important', 'felt confusing', '')] }),
    fixer: () => fixed(),
  });
  // the first verifier ran before the user test, so it cannot know U1; after the fix it must report it
  const f = byRole(calls, 'fixer');
  assert.equal(f.length, 1);
  assert.ok(f[0].prompt.includes('error shows raw JSON'));
  assert.ok(!f[0].prompt.includes('felt confusing'));
  assert.equal(result.verdict, 'PASS');
});

test('v0.4: no user tester without userTest or outside FINAL', async () => {
  const a = await runGate(finalArgs(), { verifier: () => pass() });
  assert.equal(byRole(a.calls, 'user').length, 0);
  const b = await runGate(baseArgs({ userTest: true }), { worker: () => done(), verifier: () => pass() });
  assert.equal(byRole(b.calls, 'user').length, 0);
});

test('v0.4: review covers a range, and its fixes must come with a regression test', async () => {
  const { calls } = await runGate(reviewArgs(), {
    reviewer: () => ({ findings: [finding('Important', 'huge amount returns 500')] }), fixer: () => fixed(), verifier: () => pass(),
  });
  assert.ok(/interacts/.test(byRole(calls, 'reviewer')[0].prompt));
  assert.ok(/regression test/i.test(byRole(calls, 'verifier')[0].prompt));
});

test('v0.4: lean plugin agents by default (worker/fixer vs checker), lean:false falls back to the default agent', async () => {
  const s = { worker: () => done(), verifier: (_p, _o, n) => (n === 1 ? fail() : pass()), fixer: () => fixed() };
  const { calls } = await runGate(baseArgs(), s);
  for (const c of calls) {
    const want = c.role === 'worker' || c.role === 'fixer' ? 'cto-team:worker' : 'cto-team:checker';
    assert.equal(c.opts.agentType, want, c.label);
  }
  const off = await runGate(baseArgs({ lean: false }), s);
  for (const c of off.calls) assert.equal(c.opts.agentType, undefined, c.label);
  const rv = await runGate(reviewArgs(), { reviewer: () => ({ findings: [] }) });
  assert.equal(byRole(rv.calls, 'reviewer')[0].opts.agentType, 'cto-team:checker');
});

// v0.4 Codex review fixes
const F = (id, ok = true) => ({ id, criterion: `finding ${id} fixed`, pass: ok, severity: 'Important', evidence: 'regression test: 1 passed' });

test('review: a carried finding the verifier does not re-check cannot pass', async () => {
  const s = { reviewer: () => ({ findings: [finding('Important', 'huge amount returns 500')] }), fixer: () => fixed() };
  const silent = await runGate(reviewArgs(), { ...s, verifier: () => pass() });
  assert.equal(silent.result.verdict, 'FAIL');
  assert.ok(silent.result.failing.some((c) => c.criterion.includes('F1')));
  const ok = await runGate(reviewArgs(), { ...s, verifier: () => pass({ criteria: [...pass().criteria, F('F1')] }) });
  assert.equal(ok.result.verdict, 'PASS');
  assert.ok(byRole(ok.calls, 'verifier')[0].prompt.includes('[F1]'));
});

test('verifier must report a green full suite', async () => {
  const red = await runGate(baseArgs(), { worker: () => done(), verifier: () => pass({ suite: { cmd: 'pytest -q', exit: 1, summary: '1 failed' } }), fixer: () => fixed() });
  assert.notEqual(red.result.verdict, 'PASS');
  assert.ok(red.result.failing.some((c) => /full suite/i.test(c.criterion)));
  const missing = await runGate(baseArgs(), { worker: () => done(), verifier: () => pass({ suite: undefined }), fixer: () => fixed() });
  assert.notEqual(missing.result.verdict, 'PASS');
});

test('every brief criterion must be reported when the CTO passes criteria counts', async () => {
  const tasks = [{ id: 'G2-T1', brief: 'docs/cto/briefs/G2-T1.md', files: ['app/money.py'], criteria: 2 }];
  // (criteria counts are mandatory since review round 2)
  const partial = pass({ criteria: [{ id: 'G2-T1#1', criterion: 'exact split', pass: true, severity: 'Critical', evidence: 'pytest: 1 passed' }] });
  const { result } = await runGate(baseArgs({ tasks }), { worker: () => done(), verifier: () => partial, fixer: () => fixed() });
  assert.notEqual(result.verdict, 'PASS');
  assert.ok(result.failing.some((c) => c.criterion.includes('G2-T1#2')));
});

test('critical gate with caught:null blocks', async () => {
  const { result } = await runGate(baseArgs(), { worker: () => done(), verifier: () => pass({ mutation: { checked: true, caught: null, restored: true } }) });
  assert.equal(result.verdict, 'BLOCKED');
});

test('FINAL needs briefs and a base; FINAL and review verifiers get a real range', async () => {
  await assert.rejects(runGate(finalArgs({ finalBriefs: [] }), { verifier: () => pass() }), /finalBriefs/);
  await assert.rejects(runGate(finalArgs({ branchBase: undefined }), { verifier: () => pass() }), /branchBase/);
  const fin = await runGate(finalArgs({ gateBase: undefined }), { verifier: () => pass() });
  assert.ok(byRole(fin.calls, 'verifier')[0].prompt.includes('git diff f4449b5..HEAD'));
  const rv = await runGate(reviewArgs({ gateBase: undefined }), {
    reviewer: () => ({ findings: [finding('Important', 'x')] }), fixer: () => fixed(), verifier: () => pass({ criteria: [...pass().criteria, F('F1')] }),
  });
  assert.ok(!byRole(rv.calls, 'verifier')[0].prompt.includes('undefined'));
});

test('review fixer returning BLOCKED gives BLOCKED, not a crash', async () => {
  const { result } = await runGate(reviewArgs(), {
    reviewer: () => ({ findings: [finding('Important', 'x')] }), fixer: () => ({ ...fixed(), status: 'BLOCKED', concerns: ['needs a secret'] }),
  });
  assert.equal(result.verdict, 'BLOCKED');
  assert.ok(result.blockers.some((b) => b.includes('needs a secret')));
});

test('mutation check hashes the mutated file itself (new files are untracked)', async () => {
  const { calls } = await runGate(baseArgs(), { worker: () => done(), verifier: () => pass() });
  assert.ok(byRole(calls, 'verifier')[0].prompt.includes('git hash-object <file>'));
});

test('requested user test that returns nothing blocks FINAL', async () => {
  const { result } = await runGate(finalArgs({ userTest: true }), { verifier: () => pass(), user: () => null });
  assert.equal(result.verdict, 'BLOCKED');
});

test('path aliases cannot bypass disjoint files', async () => {
  for (const [x, y] of [['app/x.py', 'app/./x.py'], ['app/x.py', 'app/sub/../x.py'], ['app/x.py', 'app//x.py']]) {
    const tasks = [{ id: 'G2-T1', brief: 'b1.md', files: [x], criteria: 1 }, { id: 'G2-T2', brief: 'b2.md', files: [y], criteria: 1 }];
    await assert.rejects(runGate(baseArgs({ tasks }), { worker: () => done(), verifier: () => pass() }), /share file/, `${x} vs ${y}`);
  }
});

// Codex review round 2
test('gate tasks must carry a positive criteria count; FINAL must carry a goals count', async () => {
  const s0 = { worker: () => done(), verifier: () => pass() };
  for (const c of [undefined, 0, -1, 1.5, 'x']) {
    const tasks = [{ id: 'G2-T1', brief: 'b1.md', files: ['app/a.py'], criteria: c }];
    await assert.rejects(runGate(baseArgs({ tasks }), s0), /criteria/, String(c));
  }
  await assert.rejects(runGate(finalArgs({ goals: undefined }), { verifier: () => pass() }), /goals/);
  const two = await runGate(finalArgs({ goals: 2 }), { verifier: () => pass(), fixer: () => fixed() });
  assert.notEqual(two.result.verdict, 'PASS');
  assert.ok(two.result.failing.some((c) => c.criterion.includes('GOAL#2')));
});

test('a carried finding passes only when re-checked as passing with evidence, at its original severity', async () => {
  const s0 = { reviewer: () => ({ findings: [finding('Important', 'huge amount returns 500')] }), fixer: () => fixed() };
  const empty = await runGate(reviewArgs(), { ...s0, verifier: () => pass({ criteria: [...pass().criteria, { ...F('F1'), evidence: '' }] }) });
  assert.notEqual(empty.result.verdict, 'PASS');
  const downgraded = await runGate(reviewArgs(), { ...s0, verifier: () => pass({ criteria: [...pass().criteria, { ...F('F1', false), severity: 'Minor', evidence: 'still 500' }] }) });
  assert.equal(downgraded.result.verdict, 'FAIL');
  assert.ok(downgraded.result.failing.some((c) => c.criterion.includes('F1') && c.severity === 'Important'));
});

test('the reported suite must be the configured test command with a summary', async () => {
  const run = (suite) => runGate(baseArgs(), { worker: () => done(), verifier: () => pass({ suite }), fixer: () => fixed() });
  assert.notEqual((await run({ cmd: 'echo fake', exit: 0, summary: 'ok' })).result.verdict, 'PASS');
  assert.notEqual((await run({ cmd: 'pytest -q', exit: 0, summary: '' })).result.verdict, 'PASS');
  assert.equal((await run({ cmd: 'pytest -q --basetemp=C:/t/pt', exit: 0, summary: '42 passed' })).result.verdict, 'PASS');
});

test('any CONTRACT: concern from a worker or fixer blocks; other fixer concerns reach the CTO', async () => {
  const w = await runGate(baseArgs(), { worker: (_p, _o, n) => done(n === 1 ? { status: 'DONE_WITH_CONCERNS', concerns: ['CONTRACT: need field total'] } : {}), verifier: () => pass() });
  assert.equal(w.result.verdict, 'BLOCKED');
  const f = await runGate(baseArgs(), {
    worker: () => done(), verifier: (_p, _o, n) => (n === 1 ? fail() : pass()),
    fixer: () => ({ ...fixed(), status: 'DONE_WITH_CONCERNS', concerns: ['CONTRACT: cap n at 1e6'] }),
  });
  assert.equal(f.result.verdict, 'BLOCKED');
  assert.ok(f.result.blockers.some((b) => b.includes('cap n')));
  const other = await runGate(baseArgs(), {
    worker: () => done(), verifier: (_p, _o, n) => (n === 1 ? fail() : pass()),
    fixer: () => ({ ...fixed(), status: 'DONE_WITH_CONCERNS', concerns: ['touched app/util.py too'] }),
  });
  assert.equal(other.result.verdict, 'PASS');
  assert.ok(other.result.concerns.some((c) => c.includes('touched app/util.py')));
});

test('briefs and files must stay inside the project', async () => {
  const s0 = { worker: () => done(), verifier: () => pass() };
  for (const t of [
    { id: 'G2-T1', brief: '../outside.md', files: ['app/a.py'], criteria: 1 },
    { id: 'G2-T1', brief: 'b1.md', files: ['../outside.py'], criteria: 1 },
    { id: 'G2-T1', brief: 'b1.md', files: ['app/../../x.py'], criteria: 1 },
    { id: 'G2-T1', brief: 'b1.md', files: ['C:/Windows/x.py'], criteria: 1 },
    { id: 'G2-T1', brief: 'b1.md', files: ['/etc/passwd'], criteria: 1 },
  ]) await assert.rejects(runGate(baseArgs({ tasks: [t] }), s0), /inside the project/, JSON.stringify(t));
  await assert.rejects(runGate(finalArgs({ finalBriefs: ['../x.md'] }), { verifier: () => pass() }), /inside the project/);
});

test('each stage writes its own result file, so review evidence is not overwritten', async () => {
  const { calls } = await runGate(reviewArgs(), {
    reviewer: () => ({ findings: [finding('Important', 'x')] }), fixer: () => fixed(), verifier: () => pass({ criteria: [...pass().criteria, F('F1')] }),
  });
  assert.ok(byRole(calls, 'reviewer')[0].prompt.includes('docs/cto/results/REVIEW.review.json'));
  assert.ok(byRole(calls, 'verifier')[0].prompt.includes('docs/cto/results/REVIEW.r1.json'));
  const fin = await runGate(finalArgs({ userTest: true }), { verifier: () => pass(), user: () => ({ findings: [] }) });
  assert.ok(byRole(fin.calls, 'verifier')[0].prompt.includes('docs/cto/results/FINAL.json'));
  assert.ok(byRole(fin.calls, 'user')[0].prompt.includes('docs/cto/results/FINAL.user.json'));
});
