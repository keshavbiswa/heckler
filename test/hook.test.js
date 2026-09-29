const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const hook = path.join(__dirname, '..', 'hooks', 'heckle-hook.js');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'heckler-test-'));

function run(event, input) {
  const out = execFileSync('node', [hook, event], {
    input: JSON.stringify({ session_id: 's1', ...input }),
    env: { ...process.env, CLAUDE_PLUGIN_DATA: dataDir },
  }).toString();
  return out ? JSON.parse(out).hookSpecificOutput.additionalContext : '';
}

test('heckle mode survives compaction and can be stopped', () => {
  assert.strictEqual(run('SessionStart', {}), '');
  assert.match(run('UserPromptSubmit', { prompt: '/heckle savage src/' }), /ACTIVE \(savage\)/);
  assert.match(run('UserPromptSubmit', { prompt: 'fix this' }), /ACTIVE \(savage\)/);
  assert.match(run('SessionStart', {}), /ACTIVE \(savage\)[\s\S]*## Iron rules/);
  assert.strictEqual(run('UserPromptSubmit', { prompt: 'stop heckling please' }), '');
  assert.strictEqual(run('SessionStart', {}), '');
});

test('model-invoked skill sets the flag, unknown level falls back to rowdy', () => {
  run('PostToolUse', { session_id: 's2', tool_input: { skill: 'heckler:heckle', args: 'loud' } });
  assert.match(run('SessionStart', { session_id: 's2' }), /ACTIVE \(rowdy\)/);
  assert.strictEqual(run('SessionStart', { session_id: 'other' }), '');
});
