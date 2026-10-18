// cto-team PreToolUse hook (Bash|PowerShell): inside a cto-team project (a folder with docs/cto/gates.md, or a
// parent of the working directory that has one), block grep/egrep/fgrep/findstr/Select-String and ask for ripgrep.
// Exit 2 = block the call; stderr is shown to Claude. Outside cto-team projects it does nothing.
const fs = require('node:fs');
const path = require('node:path');

function inCtoProject(dir) {
  let d = path.resolve(dir || process.cwd());
  for (;;) {
    if (fs.existsSync(path.join(d, 'docs', 'cto', 'gates.md'))) return true;
    const up = path.dirname(d);
    if (up === d) return false;
    d = up;
  }
}

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }
  const cmd = (input.tool_input || {}).command || '';
  if (!cmd || !inCtoProject(input.cwd)) process.exit(0);
  const code = cmd
    // drop heredoc bodies: <<'EOF' ... EOF, <<"EOF", <<-EOF
    .replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2\s*(\n|$)/g, '\n')
    // drop PowerShell here-strings @' ... '@ and @" ... "@
    .replace(/@(['"])\r?\n[\s\S]*?\r?\n\1@/g, '')
    // drop quoted strings
    .replace(/'[^'\n]*'/g, "''")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""');
  const re = /(^|[|;&(\n{]|\$\(|`|\bxargs\s+|\bsudo\s+)\s*(grep|egrep|fgrep|findstr(\.exe)?|Select-String|sls)\b/im;
  const m = code.match(re);
  if (!m) process.exit(0);
  process.stderr.write(
    `Blocked by cto-team: "${m[2]}". Use ripgrep instead.\n` +
      `- Prefer the Grep tool for content search (it runs ripgrep and is always available).\n` +
      `- In shell, if rg is installed: rg PATTERN PATH (-i, -l, -c, -n, -g '*.py', -F literal, -v invert); pipe filter: cmd | rg x.\n` +
      `- List files: rg --files -g '<glob>', or the Glob tool.`
  );
  process.exit(2);
});
