// Loads skills/deliver/workflows/gate.js the way the Workflow tool runs it,
// with agent() routed to scripted role handlers. Used only by tests.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const GATE = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'deliver', 'workflows', 'gate.js');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

export async function runGate(args, script) {
  const body = readFileSync(GATE, 'utf8').replace(/^export const meta\s*=/m, 'const meta =');
  const calls = [];
  const agent = async (prompt, opts = {}) => {
    const label = opts.label || '';
    const role = label.startsWith('worker:') ? 'worker' : label.startsWith('verify:') ? 'verifier' : label.startsWith('fix:') ? 'fixer' : label.startsWith('review:') ? 'reviewer' : label.startsWith('user:') ? 'user' : 'unknown';
    calls.push({ role, label, prompt, opts });
    const handler = script[role];
    if (!handler) throw new Error(`no handler for role ${role} (label "${label}")`);
    return handler(prompt, opts, calls.filter((c) => c.role === role).length);
  };
  const parallel = (thunks) => Promise.all(thunks.map((t) => t().catch(() => null)));
  const pipeline = () => { throw new Error('pipeline not expected in gate.js'); };
  const noop = () => {};
  const budget = { total: null, spent: () => 0, remaining: () => Infinity };
  const run = new AsyncFunction('agent', 'parallel', 'pipeline', 'phase', 'log', 'args', 'budget', body);
  const result = await run(agent, parallel, pipeline, noop, noop, args, budget);
  return { result, calls };
}
