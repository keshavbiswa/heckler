#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');

const LEVELS = ['mild', 'rowdy', 'savage'];
const STOP = /^(stop heckl(e|er|ing)|normal mode)\b/;
const COMMAND = /^\/(heckler:)?heckle(\s|$)/;

const dataDir = process.env.CLAUDE_PLUGIN_DATA || path.join(os.tmpdir(), 'heckler');
const skillPath = path.join(__dirname, '..', 'skills', 'heckle', 'SKILL.md');

function flagPath(sessionId) {
  return path.join(dataDir, `${String(sessionId).replace(/[^\w-]/g, '')}.level`);
}

function readLevel(sessionId) {
  try {
    return fs.readFileSync(flagPath(sessionId), 'utf8').trim();
  } catch {
    return null;
  }
}

function setLevel(sessionId, args) {
  const requested = String(args || '').trim().toLowerCase().split(/\s+/)[0];
  const level = LEVELS.includes(requested) ? requested : readLevel(sessionId) || 'rowdy';
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(flagPath(sessionId), level);
  return level;
}

function clearLevel(sessionId) {
  fs.rmSync(flagPath(sessionId), { force: true });
}

function skillBody() {
  return fs.readFileSync(skillPath, 'utf8').replace(/^---[\s\S]*?\n---\n/, '');
}

function emit(event, context) {
  if (!context) return;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: context } }));
}

function handle(event, input) {
  const sessionId = input.session_id;
  if (!sessionId) return;

  if (event === 'UserPromptSubmit') {
    const prompt = String(input.prompt || '').trim().toLowerCase();
    if (STOP.test(prompt)) {
      clearLevel(sessionId);
      return;
    }
    if (COMMAND.test(prompt)) setLevel(sessionId, prompt.replace(COMMAND, ''));
    const level = readLevel(sessionId);
    if (level) emit(event, `HECKLE MODE ACTIVE (${level}). Heckler voice in every response, including other skills' output. Heckle, then fix.`);
    return;
  }

  if (event === 'PostToolUse') {
    const skill = input.tool_input && input.tool_input.skill;
    if (skill === 'heckle' || skill === 'heckler:heckle') setLevel(sessionId, input.tool_input.args);
    return;
  }

  if (event === 'SessionStart') {
    const level = readLevel(sessionId);
    if (level) emit(event, `HECKLE MODE ACTIVE (${level}). It was on before this context was reset. Rules:\n\n${skillBody()}`);
  }
}

let raw = '';
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  try {
    handle(process.argv[2], JSON.parse(raw.replace(/^\uFEFF/, '')));
  } catch {}
});
