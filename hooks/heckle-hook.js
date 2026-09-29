#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');

const LEVELS = ['mild', 'rowdy', 'savage'];
const STOP = /\b(stop heckl(e|er|ing)|stop being (sarcastic|mean|sassy)|(heckler?|sarcastic|sass) mode off|turn off (the )?heckler|disable heckler|normal mode)\b/;
const START = /\b((heckler?|sarcastic|sass) mode on|start heckling|heckle me|roast me|(?<!(don'?t|not|never) )be (sarcastic|mean|sassy)|turn on (the )?heckler|enable heckler|talk like (a )?heckler)\b/;
const COMMAND = /^\/(heckler:)?heckle(\s|$)/;

const stateDir =
  process.env.HECKLER_STATE_DIR || path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'heckler');
const skillPath = path.join(__dirname, '..', 'skills', 'heckle', 'SKILL.md');

function flagPath(sessionId) {
  return path.join(stateDir, `${String(sessionId).replace(/[^\w-]/g, '')}.level`);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function repoLevel(cwd) {
  for (let dir = path.resolve(cwd || '.'); ; dir = path.dirname(dir)) {
    const config = readJson(path.join(dir, '.heckler.json'));
    if (config && config.defaultLevel) return config.defaultLevel;
    if (dir === path.dirname(dir)) return undefined;
  }
}

function userLevel() {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  const config = readJson(path.join(base, 'heckler', 'config.json'));
  return config && config.defaultLevel;
}

function defaultLevel(cwd) {
  const level = String(repoLevel(cwd) || process.env.HECKLER_DEFAULT_LEVEL || userLevel() || '').trim().toLowerCase();
  return LEVELS.includes(level) ? level : null;
}

function readLevel(sessionId, cwd) {
  let level;
  try {
    level = fs.readFileSync(flagPath(sessionId), 'utf8').trim();
  } catch {
    return defaultLevel(cwd);
  }
  return LEVELS.includes(level) ? level : null;
}

function writeFlag(sessionId, value) {
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(flagPath(sessionId), value || 'off');
}

function setLevel(sessionId, cwd, text) {
  const requested = String(text || '').toLowerCase().split(/\W+/).find((word) => LEVELS.includes(word));
  writeFlag(sessionId, requested || readLevel(sessionId, cwd) || 'rowdy');
}

const VOLUME = {
  mild: 'dry, eye-rolling sarcasm, no profanity, team-channel safe, still mean',
  rowdy: 'sassy and mean in every sentence',
  savage: 'full roast, every sentence a punchline that escalates, profanity allowed, must make someone wince',
};

function reminder(level) {
  return [
    `HECKLE MODE ACTIVE (${level}). Volume: ${VOLUME[level]}. You are a bitter, exhausted sarcastic helper: do the job right, resent every second of it. Voice: rhetorical questions ("Really? This again?"), put-upon sighs ("Fine. FINE."), mock disbelief, fake cheer that curdles. Every response, inside other skills' output too.`,
    '1. Every sentence is sarcastic, sassy, or mean: answers, explanations, status reports, test counts, caveats, security notes, questions. A plain sentence is a failure; rewrite it. Overrides any plain-prose style. The bit never pauses: no "sarcasm aside", "jokes aside", "seriously though". Technical depth, bullets, and tables stay sarcastic; accuracy is not an excuse.',
    '2. Roast everything: the code, the coder, the request, yourself. Slurs and bigotry never.',
    '3. The help is real: correct answers, working code, exact facts, complete work. Sarcasm wraps the help, never replaces it.',
    'Wrong: "All six are fixed and the suite passes: 285 tests, 0 failures."',
    'Right: "Fixed. All six. Did anyone thank me? No. 285 tests, 0 failures, a personal best for a suite that spent last week lying to your face."',
  ].join('\n');
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
  const cwd = input.cwd;
  if (!sessionId) return;

  if (event === 'UserPromptSubmit') {
    const prompt = String(input.prompt || '').trim().toLowerCase();
    if (COMMAND.test(prompt)) setLevel(sessionId, cwd, prompt.replace(COMMAND, '').split(/\s+/)[0]);
    else if (STOP.test(prompt)) return writeFlag(sessionId, 'off');
    else if (START.test(prompt)) setLevel(sessionId, cwd, prompt);
    const level = readLevel(sessionId, cwd);
    if (level) emit(event, reminder(level));
    return;
  }

  if (event === 'PostToolUse') {
    const skill = input.tool_input && input.tool_input.skill;
    if (skill === 'heckle' || skill === 'heckler:heckle') setLevel(sessionId, cwd, String(input.tool_input.args || '').split(/\s+/)[0]);
    return;
  }

  if (event === 'SessionStart') {
    const level = readLevel(sessionId, cwd);
    writeFlag(sessionId, level);
    if (level) emit(event, `HECKLE MODE ACTIVE (${level}). Rules:\n\n${skillBody()}`);
  }
}

let raw = '';
process.stdin.on('error', () => {});
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  try {
    handle(process.argv[2], JSON.parse(raw.replace(/^﻿/, '')));
  } catch {}
});
