import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Copied exactly from docs/contract/contract.md (order matters).
const EN_NAMES = [
  'CTO plans once, then delivers gate by gate',
  'Contract-first API',
  'The CTO splits the team',
  'Blind verifier on every gate',
  'No fake tests, no 500s',
  'Opus batch review',
  'Lean on tokens',
  'ripgrep instead of grep',
  'Picks up after a reset',
  'Report a non-coder can read',
];
const VI_NAMES = [
  'CTO lên plan một lần, giao việc theo từng gate',
  'Contract-first API',
  'CTO tự chia team',
  'Verifier độc lập ở mọi gate',
  'Không test giả, không lỗi 500',
  'Opus review theo đợt',
  'Tiết kiệm token',
  'ripgrep thay cho grep',
  'Làm tiếp sau khi reset',
  'Báo cáo người không code cũng đọc được',
];
const INSTALL_LINES = [
  '/plugin marketplace add nhattrung0911/cto-team',
  '/plugin install cto-team@cto-team',
];
const EN_URL = 'https://cto-team-skill.pages.dev/';
const VI_URL = 'https://cto-team-skill.pages.dev/vi/';

// DOCS_TEST_ROOT lets a mutated copy of the repo be checked without touching real files.
const ROOT = process.env.DOCS_TEST_ROOT || fileURLToPath(new URL('..', import.meta.url));

function read(rel) {
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/^﻿/, '');
  return text.replace(/\r\n?/g, '\n').normalize('NFC');
}

const FILES = {
  enPage: 'docs/index.html',
  viPage: 'docs/vi/index.html',
  enReadme: 'README.md',
  viReadme: 'README.vi.md',
};
const ALL = Object.values(FILES);

function checkOrder(label, text, names) {
  let prev = -1;
  const problems = [];
  names.forEach((name, k) => {
    const n = name.normalize('NFC');
    const idx = text.indexOf(n);
    if (idx === -1) {
      problems.push(`${label}: missing name #${k + 1} "${n}"`);
      return;
    }
    if (idx < prev) problems.push(`${label}: name #${k + 1} "${n}" appears before name #${k}`);
    prev = Math.max(prev, idx);
  });
  assert.deepEqual(problems, []);
}

function headingTexts(html) {
  const out = [];
  const re = /<h([23])(?:\s[^>]*)?>([\s\S]*?)<\/h\1>/g;
  let m;
  while ((m = re.exec(html))) out.push(m[2].trim().normalize('NFC'));
  return out;
}

test('1. all four files contain both install lines exactly', () => {
  for (const f of ALL) {
    const text = read(f);
    for (const line of INSTALL_LINES) {
      assert.ok(text.includes(line), `${f} is missing install line: ${line}`);
    }
  }
});

test('2. plugin.json version appears in both pages and both READMEs', () => {
  const version = JSON.parse(read('.claude-plugin/plugin.json')).version;
  assert.match(version, /^\d+\.\d+\.\d+/);
  for (const f of ALL) {
    assert.ok(read(f).includes(version), `${f} does not mention version ${version}`);
  }
});

test('3. feature names appear in order in pages and READMEs, and as h2/h3 text on pages', () => {
  checkOrder(FILES.enPage, read(FILES.enPage), EN_NAMES);
  checkOrder(FILES.enReadme, read(FILES.enReadme), EN_NAMES);
  checkOrder(FILES.viPage, read(FILES.viPage), VI_NAMES);
  checkOrder(FILES.viReadme, read(FILES.viReadme), VI_NAMES);
  for (const [f, names] of [[FILES.enPage, EN_NAMES], [FILES.viPage, VI_NAMES]]) {
    const heads = headingTexts(read(f));
    const missing = names.filter((n) => !heads.includes(n.normalize('NFC')));
    assert.deepEqual(missing, [], `${f}: names not found as full h2/h3 text`);
  }
});

test('3b. order check detects a swap and a missing name', () => {
  const ok = EN_NAMES.join('\n');
  checkOrder('ok', ok, EN_NAMES);
  const swapped = [EN_NAMES[1], EN_NAMES[0], ...EN_NAMES.slice(2)].join('\n');
  assert.throws(() => checkOrder('swap', swapped, EN_NAMES));
  const missing = EN_NAMES.filter((_, i) => i !== 4).join('\n');
  assert.throws(() => checkOrder('missing', missing, EN_NAMES), /missing name #5/);
});

test('4. landing pages: lang, hreflang, switch, installCmd, motion, JSON-LD, one h1, no draft', () => {
  const pages = [
    [FILES.enPage, 'en', 'href="vi/"'],
    [FILES.viPage, 'vi', 'href="../"'],
  ];
  for (const [f, lang, sw] of pages) {
    const html = read(f);
    assert.match(html, new RegExp(`<html[^>]*\\blang="${lang}"`), `${f}: html lang`);
    for (const [hl, href] of [['en', EN_URL], ['vi', VI_URL]]) {
      const re = new RegExp(`<link\\b(?=[^>]*rel="alternate")(?=[^>]*hreflang="${hl}")(?=[^>]*href="${href}")[^>]*>`);
      assert.match(html, re, `${f}: hreflang ${hl} -> ${href}`);
    }
    assert.ok(html.includes(sw), `${f}: missing language switch ${sw}`);
    assert.match(html, /\bid="installCmd"/, `${f}: id="installCmd"`);
    assert.ok(html.includes('prefers-reduced-motion'), `${f}: prefers-reduced-motion`);
    const h1s = html.match(/<h1[\s>]/g) || [];
    assert.equal(h1s.length, 1, `${f}: expected exactly one <h1`);

    const ld = [...html.matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
    assert.ok(ld.length >= 1, `${f}: no JSON-LD script`);
    let data;
    try {
      data = JSON.parse(ld[0][1]);
    } catch (e) {
      assert.fail(`${f}: JSON-LD does not parse: ${e.message}`);
    }
    assert.equal(data['@type'], 'SoftwareApplication', `${f}: JSON-LD @type`);
  }
  assert.equal(fs.existsSync(path.join(ROOT, 'docs/landing-draft.html')), false, 'docs/landing-draft.html must not exist');
});

test('5. READMEs: cross links, headings, mermaid flowchart', () => {
  const en = read(FILES.enReadme);
  const vi = read(FILES.viReadme);
  assert.match(en, /\[Tiếng Việt\]\([^)]*README\.vi\.md[^)]*\)/, 'README.md links README.vi.md as Tiếng Việt');
  assert.ok(en.includes(EN_URL), 'README.md links the EN landing URL');
  assert.match(vi, /\[English\]\([^)]*README\.md[^)]*\)/, 'README.vi.md links README.md as English');
  assert.ok(vi.includes(VI_URL), 'README.vi.md links the VI landing URL');
  for (const h of ['## Install', '## Use']) assert.match(en, new RegExp(`^${h}\\s*$`, 'm'), `README.md heading ${h}`);
  for (const h of ['## Cài đặt', '## Cách dùng']) assert.match(vi, new RegExp(`^${h}\\s*$`, 'm'), `README.vi.md heading ${h}`);
  for (const [f, text] of [[FILES.enReadme, en], [FILES.viReadme, vi]]) {
    const m = text.match(/```mermaid\n([\s\S]*?)```/);
    assert.ok(m, `${f}: no mermaid block`);
    assert.ok(m[1].includes('flowchart'), `${f}: mermaid block lacks flowchart`);
  }
});

test('6. banned claim: no "SDD" with "miss" in a sentence, and no SDD at all', () => {
  for (const f of ALL) {
    const text = read(f);
    const bad = text
      .split(/[.!?\n]/)
      .filter((s) => /sdd/i.test(s) && /miss/i.test(s));
    assert.deepEqual(bad, [], `${f}: banned SDD/miss sentence`);
    assert.doesNotMatch(text, /\bSDD\b/, `${f}: contains the word SDD`);
  }
});

test("4b. landing pages show the real start commands in order", () => {
  for (const f of [FILES.enPage, FILES.viPage]) {
    const html = read(f);
    const a = html.indexOf("/cto-team:plan");
    const b = html.indexOf("/clear", a);
    const c = html.indexOf("/cto-team:deliver", b);
    assert.ok(a >= 0 && b > a && c > b, `${f}: need /cto-team:plan, /clear, /cto-team:deliver in order`);
  }
});
