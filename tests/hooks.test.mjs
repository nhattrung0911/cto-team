import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = join(ROOT, 'hooks', 'prefer-rg.cjs');
const run = (command, cwd) => spawnSync(process.execPath, [HOOK], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd }), encoding: 'utf8' });

const ctoProject = () => {
  const d = mkdtempSync(join(tmpdir(), 'cto-hook-'));
  mkdirSync(join(d, 'docs', 'cto'), { recursive: true });
  writeFileSync(join(d, 'docs', 'cto', 'gates.md'), '| Gate |');
  mkdirSync(join(d, 'app'));
  return d;
};

test('hooks.json registers the rg hook for Bash and PowerShell', () => {
  const h = JSON.parse(readFileSync(join(ROOT, 'hooks', 'hooks.json'), 'utf8'));
  const entry = h.hooks.PreToolUse.find((e) => e.matcher === 'Bash|PowerShell');
  assert.ok(entry.hooks[0].command.includes('${CLAUDE_PLUGIN_ROOT}') && entry.hooks[0].command.includes('prefer-rg.cjs'));
});

test('blocks grep, findstr and Select-String inside a cto-team project (also from a subfolder)', () => {
  const d = ctoProject();
  for (const c of ['grep -rn foo app', 'cat x | grep foo', 'findstr /s foo *.py', 'Get-Content a | Select-String foo', 'git ls-files | xargs grep foo']) {
    const r = run(c, d);
    assert.equal(r.status, 2, c);
    assert.match(r.stderr, /rg|Grep tool/);
  }
  assert.equal(run('grep foo app', join(d, 'app')).status, 2);
});

test('allows rg, quoted mentions and heredoc text inside a cto-team project', () => {
  const d = ctoProject();
  for (const c of ['rg -n foo app', 'echo "use grep here"', "git commit -m 'no grep'", "cat <<'EOF'\ngrep foo\nEOF"]) {
    assert.equal(run(c, d).status, 0, c);
  }
});

test('does nothing outside a cto-team project', () => {
  const d = mkdtempSync(join(tmpdir(), 'plain-'));
  assert.equal(run('grep -rn foo .', d).status, 0);
});
