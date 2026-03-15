---
name: hot-repo-radar
description: Use when the user wants a GitHub trending pulse, asks for daily or weekly hot repositories, or wants a short markdown briefing about current GitHub momentum.
---

# hot-repo-radar

Capture GitHub Trending into dated local snapshots, compare the latest snapshot with the nearest earlier capture, and produce a concise markdown briefing. The skill can optionally translate English summaries into Chinese and keeps its own cache under `~/.hot-repo-radar`.

## When to use

- The user asks what is currently hot on GitHub
- The user wants a daily, weekly, or monthly pulse
- The user wants to know which repositories just entered the list or moved sharply upward
- The user needs a markdown digest rather than a raw HTML scrape

## How to run

```bash
# collect snapshots
node <skill_path>/scripts/fetch-trending.js

# generate the briefing
node <skill_path>/scripts/generate-report.js
```

Useful flags:

- `--date YYYY-MM-DD` to target a specific snapshot day
- `--only daily,weekly` to limit the windows you collect or render
- `--refresh` to overwrite an existing snapshot
- `--raw-language` to skip translation in the final report

## Output layout

- Snapshots: `~/.hot-repo-radar/snapshots/YYYY-MM-DD/{window}.json`
- Reports: `~/.hot-repo-radar/reports/radar-YYYY-MM-DD.md`
- Translation cache: `~/.hot-repo-radar/cache/translations.json`

## Report sections

1. Observation summary
2. Leaderboard table
3. New arrivals
4. Exits
5. Strongest upward moves

## References

- `scripts/runtime.js`
- `scripts/trending.js`
- `scripts/translation.js`
- `scripts/report.js`
- `references/report-format.md`
