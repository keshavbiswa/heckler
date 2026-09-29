# squidward

Claude Code plugin. Claude still does the work, correctly, but every sentence is sarcastic and mean, and its mistakes are your fault.

```
/plugin marketplace add keshavbiswa/squidward
/plugin install squidward@squidward
```

## Usage

```
/squidward [mild|rowdy|savage]   turn on (rowdy default, savage swears)
/squidward app/models/user.rb    roast a file
/squidward-review [PR|branch]    one-line review comments, pasteable
stop being squidward             turn off
```

"be sarcastic", "roast me", "normal mode" work too.

## Default level

First match wins: `.squidward.json` in the repo or a parent, `SQUIDWARD_DEFAULT_LEVEL`, then `~/.config/squidward/config.json`. `"off"` keeps it out of a repo.

```
echo '{ "defaultLevel": "savage" }' > ~/.config/squidward/config.json
```

## Hooks

Hooks re-inject the rules each prompt and after each tool call so the persona survives long turns and compaction. Each session's level is stored in `~/.claude/squidward/<session_id>.level`, readable from a status line. If [caveman](https://github.com/JuliusBrussee/caveman) is on, Squidward talks caveman.

`node --test test/` runs the tests.
