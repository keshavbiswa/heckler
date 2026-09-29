const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const hook = path.join(__dirname, '..', 'hooks', 'squidward-hook.js');
const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'squidward-test-'));
const configHome = fs.mkdtempSync(path.join(os.tmpdir(), 'squidward-config-'));
const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'squidward-repo-'));

function run(event, input, env = {}) {
  const out = execFileSync('node', [hook, event], {
    input: JSON.stringify({ session_id: 's1', cwd: os.tmpdir(), ...input }),
    env: { ...process.env, SQUIDWARD_DEFAULT_LEVEL: '', XDG_CONFIG_HOME: configHome, CLAUDE_CONFIG_DIR: configHome, SQUIDWARD_STATE_DIR: stateDir, ...env },
  }).toString();
  return out ? JSON.parse(out).hookSpecificOutput.additionalContext : '';
}

function flag(sessionId) {
  return fs.readFileSync(path.join(stateDir, `${sessionId}.level`), 'utf8');
}

test('squidward mode survives compaction and can be stopped', () => {
  assert.strictEqual(run('SessionStart', {}), '');
  assert.strictEqual(flag('s1'), 'off');
  assert.match(run('UserPromptSubmit', { prompt: '/squidward savage src/' }), /ACTIVE \(savage\)/);
  assert.strictEqual(flag('s1'), 'savage');
  assert.match(run('UserPromptSubmit', { prompt: 'fix this' }), /ACTIVE \(savage\)/);
  assert.match(run('UserPromptSubmit', { prompt: 'fix this' }), /Only the user.s off command ends the persona/);
  assert.match(run('SessionStart', {}), /ACTIVE \(savage\)[\s\S]*## Iron rules/);
  assert.strictEqual(run('UserPromptSubmit', { prompt: 'ok please stop being squidward' }), '');
  assert.strictEqual(run('SessionStart', {}), '');
});

test('model-invoked skill sets the flag, unknown level falls back to rowdy', () => {
  run('PostToolUse', { session_id: 's2', tool_input: { skill: 'squidward:squidward', args: 'loud' } });
  assert.match(run('SessionStart', { session_id: 's2' }), /ACTIVE \(rowdy\)/);
  assert.strictEqual(run('SessionStart', { session_id: 'other' }), '');
  assert.match(run('PostToolUse', { session_id: 's2', tool_input: { command: 'ls' } }), /still Squidward \(rowdy\)/);
  assert.strictEqual(run('PostToolUse', { session_id: 'other', tool_input: { command: 'ls' } }), '');
});

test('plain language turns it on and off', () => {
  assert.strictEqual(run('UserPromptSubmit', { session_id: 's5', prompt: 'how does squidward mode work' }), '');
  assert.match(run('UserPromptSubmit', { session_id: 's5', prompt: 'be like squidward, go savage' }), /ACTIVE \(savage\)/);
  assert.match(run('UserPromptSubmit', { session_id: 's5', prompt: 'turn on the squidward' }), /ACTIVE \(savage\)/);
  assert.strictEqual(run('UserPromptSubmit', { session_id: 's5', prompt: 'squidward mode off' }), '');
  assert.match(run('UserPromptSubmit', { session_id: 's5', prompt: 'roast me' }), /ACTIVE \(rowdy\)/);
  assert.strictEqual(run('UserPromptSubmit', { session_id: 's5', prompt: 'stop being sarcastic' }), '');
  assert.strictEqual(run('UserPromptSubmit', { session_id: 's5', prompt: "don't be sarcastic here" }), '');
  assert.match(run('UserPromptSubmit', { session_id: 's5', prompt: 'be sarcastic, savage please' }), /ACTIVE \(savage\)[\s\S]*sarcastic helper/);
});

test('configured default level is on from session start and can be stopped', () => {
  fs.mkdirSync(path.join(configHome, 'squidward'), { recursive: true });
  fs.writeFileSync(path.join(configHome, 'squidward', 'config.json'), JSON.stringify({ defaultLevel: 'savage' }));
  assert.match(run('SessionStart', { session_id: 's3' }), /ACTIVE \(savage\)[\s\S]*## Iron rules/);
  assert.match(run('UserPromptSubmit', { session_id: 's3', prompt: 'fix this' }), /ACTIVE \(savage\)/);
  assert.match(run('UserPromptSubmit', { session_id: 's3', prompt: '/squidward mild' }), /ACTIVE \(mild\)/);
  assert.strictEqual(run('UserPromptSubmit', { session_id: 's3', prompt: 'squidward mode off' }), '');
  assert.strictEqual(run('SessionStart', { session_id: 's3' }), '');
  assert.match(run('SessionStart', { session_id: 's4' }, { SQUIDWARD_DEFAULT_LEVEL: 'mild' }), /ACTIVE \(mild\)/);

  fs.mkdirSync(path.join(repo, 'app', 'models'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.squidward.json'), JSON.stringify({ defaultLevel: 'off' }));
  const nested = path.join(repo, 'app', 'models');
  assert.strictEqual(run('SessionStart', { session_id: 's6', cwd: nested }, { SQUIDWARD_DEFAULT_LEVEL: 'mild' }), '');
  assert.match(run('UserPromptSubmit', { session_id: 's6', cwd: nested, prompt: '/squidward' }), /ACTIVE \(rowdy\)/);
  fs.rmSync(path.join(configHome, 'squidward'), { recursive: true });
});

test('broken stdin does not crash the hook', () => {
  execFileSync('node', [hook, 'UserPromptSubmit'], { input: 'not json' });
});

test('caveman on adds the caveman squidward line, off leaves it out', () => {
  assert.doesNotMatch(run('UserPromptSubmit', { session_id: 's7', prompt: '/squidward rowdy' }), /caveman grammar/);
  fs.writeFileSync(path.join(configHome, '.caveman-active'), 'full');
  assert.match(run('UserPromptSubmit', { session_id: 's7', prompt: 'fix this' }), /Caveman full is on[\s\S]*ACTIVE \(rowdy\)/);
  fs.writeFileSync(path.join(configHome, '.caveman-active'), 'off');
  assert.doesNotMatch(run('UserPromptSubmit', { session_id: 's7', prompt: 'fix this' }), /caveman grammar/);
  fs.rmSync(path.join(configHome, '.caveman-active'));
});
