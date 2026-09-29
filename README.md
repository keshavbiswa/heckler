# squidward

A Claude Code plugin that turns Claude into a sarcastic helper. It still does whatever you ask, correctly and completely, but every sentence comes back sarcastic, sassy, and mean. It roasts your code, your request, you, and itself.

## Install

```
/plugin marketplace add keshavbiswa/heckler
/plugin install squidward@squidward
```

## Usage

```
/squidward                   turn on sarcastic mode
/squidward savage            full roast
/squidward mild              dry sarcasm, team-channel safe
/squidward app/models/user.rb roast a file as a review
stop being squidward         turn it off
```

Plain language works too. "be sarcastic", "sarcastic mode on", "roast me", "be like squidward" or "squidward mode on" turn it on, and a level word in the same prompt sets the level ("be sarcastic, go savage"). "stop being sarcastic", "stop being squidward", "squidward mode off" or "normal mode" turn it off.

### Code review

```
/squidward-review            review the current diff, one line per finding
/squidward-review 42         review PR #42
/squidward-review savage main review a branch at maximum volume
```

Output is `file:line: tag: roast. fix.`, terse enough to paste as PR comments. Tags: `bug`, `security`, `perf`, `bloat`, `wheel`, `read`, `nit`.

Levels: `mild`, `rowdy` (default), `savage`. Only the volume changes, never the quality of the help.

### Always on

Set a default level and squidward turns on at the start of every session, no `/squidward` needed:

```
mkdir -p ~/.config/squidward
echo '{ "defaultLevel": "savage" }' > ~/.config/squidward/config.json
```

Or set `SQUIDWARD_DEFAULT_LEVEL=savage` in the `env` block of your Claude Code `settings.json`. The env var wins over the file. `/squidward mild` still switches level for the session, and "stop being squidward" still turns it off.

### Per-repo

A `.squidward.json` in a repo, or any parent directory, overrides both. Use it to keep squidward out of a work repo, or to crank one up:

```
echo '{ "defaultLevel": "off" }' > .squidward.json
```

The closest file wins. An explicit `/squidward` still turns it on for that session.

### Status line badge

The hook records each session's level in `${CLAUDE_CONFIG_DIR:-~/.claude}/squidward/<session_id>.level`. Add this to your `statusLine` command to show `[SQUIDWARD:SAVAGE]` while it is on:

```bash
input=$(cat)
sid=$(echo "$input" | jq -r '.session_id')
level=$(cat "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/squidward/$sid.level" 2>/dev/null)
case "$level" in
  mild|rowdy|savage) printf '\033[38;5;203m[SQUIDWARD:%s]\033[0m' "$(echo "$level" | tr a-z A-Z)" ;;
esac
```

Works with [caveman](https://github.com/JuliusBrussee/caveman): when caveman mode is on, Squidward talks caveman: same bitterness, same rhetorical questions, caveman grammar. The hook reads caveman's flag file, so it switches automatically. Code stays normal.

## Update

```
/plugin marketplace update squidward
```

## Development

`node --test test/` runs the hook check.
