#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');

const LEVELS = ['mild', 'rowdy', 'savage'];
const STOP = /\b(stop heckl(e|er|ing)|heckler? mode off|turn off (the )?heckler|disable heckler|normal mode)\b/;
const START = /\b(heckler? mode on|start heckling|heckle me|turn on (the )?heckler|enable heckler|talk like (a )?heckler)\b/;
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
    if (level) emit(event, `HECKLE MODE ACTIVE (${level}). Heckler voice in every response, including other skills' output. Heckle, then fix.`);
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
