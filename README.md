# heckler

A Claude Code plugin that turns Claude into a sarcastic helper. It still does whatever you ask, correctly and completely, but every sentence comes back sarcastic, sassy, and mean. It roasts your code, your request, you, and itself.

## Install

```
/plugin marketplace add keshavbiswa/heckler
/plugin install heckler@heckler
```

## Usage

```
/heckle                      turn on sarcastic mode
/heckle savage               full roast
/heckle mild                 dry sarcasm, team-channel safe
/heckle app/models/user.rb   roast a file as a review
stop heckling                turn it off
```

Plain language works too. "be sarcastic", "sarcastic mode on", "roast me", "start heckling" or "heckler mode on" turn it on, and a level word in the same prompt sets the level ("be sarcastic, go savage"). "stop being sarcastic", "stop heckling", "sarcastic mode off" or "normal mode" turn it off.

### Code review

```
/heckle-review               review the current diff, one line per finding
/heckle-review 42            review PR #42
/heckle-review savage main   review a branch at maximum volume
```

Output is `file:line: tag: roast. fix.`, terse enough to paste as PR comments. Tags: `bug`, `security`, `perf`, `bloat`, `wheel`, `read`, `nit`.

Levels: `mild`, `rowdy` (default), `savage`. Only the volume changes, never the quality of the help.

### Always on

Set a default level and heckler turns on at the start of every session, no `/heckle` needed:

```
mkdir -p ~/.config/heckler
echo '{ "defaultLevel": "savage" }' > ~/.config/heckler/config.json
```

Or set `HECKLER_DEFAULT_LEVEL=savage` in the `env` block of your Claude Code `settings.json`. The env var wins over the file. `/heckle mild` still switches level for the session, and `stop heckle` still turns it off.

### Per-repo

A `.heckler.json` in a repo, or any parent directory, overrides both. Use it to keep heckler out of a work repo, or to crank one up:

```
echo '{ "defaultLevel": "off" }' > .heckler.json
```

The closest file wins. An explicit `/heckle` still turns it on for that session.

### Status line badge

The hook records each session's level in `${CLAUDE_CONFIG_DIR:-~/.claude}/heckler/<session_id>.level`. Add this to your `statusLine` command to show `[HECKLER:SAVAGE]` while it is on:

```bash
input=$(cat)
sid=$(echo "$input" | jq -r '.session_id')
level=$(cat "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/heckler/$sid.level" 2>/dev/null)
case "$level" in
  mild|rowdy|savage) printf '\033[38;5;203m[HECKLER:%s]\033[0m' "$(echo "$level" | tr a-z A-Z)" ;;
esac
```

Works with [caveman](https://github.com/JuliusBrussee/caveman): when caveman mode is on, the sarcasm comes out in caveman speak. Code stays normal.

## Update

```
/plugin marketplace update heckler
```

## Development

`node --test test/` runs the hook check.
