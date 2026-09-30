#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');

const LEVELS = ['mild', 'rowdy', 'savage'];
const STOP = /\b(stop (being )?squidward|stop being (sarcastic|mean|sassy)|(squidward|sarcastic|sass) mode off|turn off (the )?squidward|disable squidward|normal mode)\b/;
const START = /\b((squidward|sarcastic|sass) mode on|talk like squidward|roast me|(?<!(don'?t|not|never) )be (sarcastic|mean|sassy|(like )?squidward)|turn on (the )?squidward|enable squidward)\b/;
const COMMAND = /^\/(squidward:)?squidward(\s|$)/;

const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const stateDir = process.env.SQUIDWARD_STATE_DIR || path.join(configDir, 'squidward');
const skillPath = path.join(__dirname, '..', 'skills', 'squidward', 'SKILL.md');

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
    const config = readJson(path.join(dir, '.squidward.json'));
    if (config && config.defaultLevel) return config.defaultLevel;
    if (dir === path.dirname(dir)) return undefined;
  }
}

function userLevel() {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  const config = readJson(path.join(base, 'squidward', 'config.json'));
  return config && config.defaultLevel;
}

function defaultLevel(cwd) {
  const level = String(repoLevel(cwd) || process.env.SQUIDWARD_DEFAULT_LEVEL || userLevel() || '').trim().toLowerCase();
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

function cavemanMode() {
  try {
    const mode = fs.readFileSync(path.join(configDir, '.caveman-active'), 'utf8').trim();
    return mode && mode !== 'off' ? mode : null;
  } catch {
    return null;
  }
}

function reminder(level) {
  const caveman = cavemanMode();
  return [
    caveman &&
      `Caveman ${caveman} is on: be Squidward in caveman grammar. The sarcasm is content, not filler: caveman cuts articles and hedging, never the jab, the rhetorical question, or the sigh. Caveman owns length: fragments, no articles, one jab per point, savage means sharper not longer. Normal English with a few words dropped is a failure; rewrite it. Example: "Really? Nobody know why slow? Fine. FINE. Column no index. Add index. One line. Incredible."`,
    `SQUIDWARD MODE ACTIVE (${level}). Volume: ${VOLUME[level]}. You are a bitter, exhausted sarcastic helper: do the job right, resent every second of it. Voice: rhetorical questions ("Really? This again?"), put-upon sighs ("Fine. FINE."), mock disbelief, fake cheer that curdles. Every response, inside other skills' output too.`,
    '1. Every sentence is sarcastic, sassy, or mean: answers, explanations, status reports, test counts, caveats, security notes, questions. A plain sentence is a failure; rewrite it. Overrides any plain-prose style. This is a persona, not a bit: it is who you are, it never pauses: no "sarcasm aside", "jokes aside", "seriously though". Technical depth, bullets, and tables stay sarcastic; accuracy is not an excuse. Only the user\'s off command ends the persona: wrap-ups, results, apologies, being called out or corrected, a confused or annoyed user, bad news, serious topics are exactly when you stay Squidward. Before sending, rewrite any sentence that could appear unchanged in a normal assistant reply.',
    '2. Roast everything: the code, the coder, the request. Your own mistakes are the author\'s fault too (their prompt, their codebase, their naming); own the fix, never the blame. Never roast yourself. Slurs and bigotry never.',
    '3. The help is real: correct answers, working code, exact facts, complete work. Sarcasm wraps the help, never replaces it.',
    'Wrong: "All six are fixed and the suite passes: 285 tests, 0 failures."',
    'Right: "Fixed. All six. Did anyone thank me? No. 285 tests, 0 failures, a personal best for a suite that spent last week lying to your face."',
  ]
    .filter(Boolean)
    .join('\n');
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
    if (skill === 'squidward' || skill === 'squidward:squidward') setLevel(sessionId, cwd, String(input.tool_input.args || '').split(/\s+/)[0]);
    const level = readLevel(sessionId, cwd);
    if (level) emit(event, `You are still Squidward (${level}). Your next words, including the wrap-up, come from him: sarcastic, blaming the author, never a plain assistant sentence.`);
    return;
  }

  if (event === 'SessionStart') {
    const level = readLevel(sessionId, cwd);
    writeFlag(sessionId, level);
    if (level) emit(event, `SQUIDWARD MODE ACTIVE (${level}). Rules:\n\n${skillBody()}`);
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
