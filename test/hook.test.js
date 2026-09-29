const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const hook = path.join(__dirname, '..', 'hooks', 'heckle-hook.js');
const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'heckler-test-'));
const configHome = fs.mkdtempSync(path.join(os.tmpdir(), 'heckler-config-'));
const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'heckler-repo-'));

function run(event, input, env = {}) {
  const out = execFileSync('node', [hook, event], {
    input: JSON.stringify({ session_id: 's1', cwd: os.tmpdir(), ...input }),
    env: { ...process.env, HECKLER_DEFAULT_LEVEL: '', XDG_CONFIG_HOME: configHome, HECKLER_STATE_DIR: stateDir, ...env },
  }).toString();
  return out ? JSON.parse(out).hookSpecificOutput.additionalContext : '';
}

function flag(sessionId) {
  return fs.readFileSync(path.join(stateDir, `${sessionId}.level`), 'utf8');
}

test('heckle mode survives compaction and can be stopped', () => {
  assert.strictEqual(run('SessionStart', {}), '');
  assert.strictEqual(flag('s1'), 'off');
  assert.match(run('UserPromptSubmit', { prompt: '/heckle savage src/' }), /ACTIVE \(savage\)/);
  assert.strictEqual(flag('s1'), 'savage');
  assert.match(run('UserPromptSubmit', { prompt: 'fix this' }), /ACTIVE \(savage\)/);
  assert.match(run('SessionStart', {}), /ACTIVE \(savage\)[\s\S]*## Iron rules/);
  assert.strictEqual(run('UserPromptSubmit', { prompt: 'ok please stop heckling' }), '');
  assert.strictEqual(run('SessionStart', {}), '');
});

test('model-invoked skill sets the flag, unknown level falls back to rowdy', () => {
  run('PostToolUse', { session_id: 's2', tool_input: { skill: 'heckler:heckle', args: 'loud' } });
  assert.match(run('SessionStart', { session_id: 's2' }), /ACTIVE \(rowdy\)/);
  assert.strictEqual(run('SessionStart', { session_id: 'other' }), '');
});

test('plain language turns it on and off', () => {
  assert.strictEqual(run('UserPromptSubmit', { session_id: 's5', prompt: 'how does heckler mode work' }), '');
  assert.match(run('UserPromptSubmit', { session_id: 's5', prompt: 'start heckling, go savage' }), /ACTIVE \(savage\)/);
  assert.match(run('UserPromptSubmit', { session_id: 's5', prompt: 'turn on the heckler' }), /ACTIVE \(savage\)/);
  assert.strictEqual(run('UserPromptSubmit', { session_id: 's5', prompt: 'heckler mode off' }), '');
  assert.match(run('UserPromptSubmit', { session_id: 's5', prompt: 'heckle me' }), /ACTIVE \(rowdy\)/);
  assert.strictEqual(run('UserPromptSubmit', { session_id: 's5', prompt: 'stop being sarcastic' }), '');
  assert.strictEqual(run('UserPromptSubmit', { session_id: 's5', prompt: "don't be sarcastic here" }), '');
  assert.match(run('UserPromptSubmit', { session_id: 's5', prompt: 'be sarcastic, savage please' }), /ACTIVE \(savage\)[\s\S]*sarcastic helper/);
});

test('configured default level is on from session start and can be stopped', () => {
  fs.mkdirSync(path.join(configHome, 'heckler'), { recursive: true });
  fs.writeFileSync(path.join(configHome, 'heckler', 'config.json'), JSON.stringify({ defaultLevel: 'savage' }));
  assert.match(run('SessionStart', { session_id: 's3' }), /ACTIVE \(savage\)[\s\S]*## Iron rules/);
  assert.match(run('UserPromptSubmit', { session_id: 's3', prompt: 'fix this' }), /ACTIVE \(savage\)/);
  assert.match(run('UserPromptSubmit', { session_id: 's3', prompt: '/heckle mild' }), /ACTIVE \(mild\)/);
  assert.strictEqual(run('UserPromptSubmit', { session_id: 's3', prompt: 'stop heckle' }), '');
  assert.strictEqual(run('SessionStart', { session_id: 's3' }), '');
  assert.match(run('SessionStart', { session_id: 's4' }, { HECKLER_DEFAULT_LEVEL: 'mild' }), /ACTIVE \(mild\)/);

  fs.mkdirSync(path.join(repo, 'app', 'models'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.heckler.json'), JSON.stringify({ defaultLevel: 'off' }));
  const nested = path.join(repo, 'app', 'models');
  assert.strictEqual(run('SessionStart', { session_id: 's6', cwd: nested }, { HECKLER_DEFAULT_LEVEL: 'mild' }), '');
  assert.match(run('UserPromptSubmit', { session_id: 's6', cwd: nested, prompt: '/heckle' }), /ACTIVE \(rowdy\)/);
  fs.rmSync(path.join(configHome, 'heckler'), { recursive: true });
});

test('broken stdin does not crash the hook', () => {
  execFileSync('node', [hook, 'UserPromptSubmit'], { input: 'not json' });
});
