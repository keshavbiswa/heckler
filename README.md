# heckler

A Claude Code plugin that heckles your code, then fixes it. Every heckle is tied to a real defect and ships with a better solution.

## Install

```
/plugin marketplace add keshavbiswa/heckler
/plugin install heckler@heckler
```

## Usage

```
/heckle                      heckle the current uncommitted diff
/heckle app/models/user.rb   heckle a file
/heckle savage src/          maximum volume
/heckle mild                 team-channel safe
stop heckle                  turn it off
```

### Code review

```
/peanut-gallery              heckle-review the current diff, one line per finding
/peanut-gallery 42           heckle-review PR #42
/peanut-gallery savage main  review a branch at maximum volume
```

Output is `file:line: tag: heckle. fix.`, terse enough to paste as PR comments. Tags: `bug`, `security`, `perf`, `bloat`, `wheel`, `read`, `nit`.

Levels: `mild`, `rowdy` (default), `savage`. Only the volume changes, never the rigor.

Works with [caveman](https://github.com/JuliusBrussee/caveman): when caveman mode is on, heckles come out in caveman speak. Fix code stays normal.

## Update

```
/plugin marketplace update heckler
```

## Development

`node --test test/` runs the hook check.
