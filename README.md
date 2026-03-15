# hot-repo-radar

English | [简体中文](./README_CN.md)

A zero-dependency Node.js radar for GitHub Trending. It records daily snapshots under a project-specific workspace, compares them with the latest earlier capture, optionally translates summaries to Chinese, and emits a compact Markdown briefing.

## Highlights

- Project-specific storage under `~/.hot-repo-radar`
- Snapshot folders grouped by date instead of flat files
- Separate modules for runtime, scraping, translation, and report rendering
- Markdown briefing focused on arrivals, exits, and strongest movers
- No external npm packages

## Quick start

```bash
# collect today's three windows
node scripts/fetch-trending.js

# build today's briefing
node scripts/generate-report.js
```

Output locations:

- Snapshots: `~/.hot-repo-radar/snapshots/YYYY-MM-DD/{window}.json`
- Reports: `~/.hot-repo-radar/reports/radar-YYYY-MM-DD.md`
- Translation cache: `~/.hot-repo-radar/cache/translations.json`

## CLI examples

```bash
# refresh only the daily and weekly snapshots for a given day
node scripts/fetch-trending.js --date 2026-03-15 --only daily,weekly --refresh

# create a briefing without translation
node scripts/generate-report.js --date 2026-03-15 --raw-language
```

## Config

`config.json` exposes the main runtime knobs:

```json
{
  "workspaceDir": "~/.hot-repo-radar",
  "snapshotDir": "~/.hot-repo-radar/snapshots",
  "reportDir": "~/.hot-repo-radar/reports",
  "translationCachePath": "~/.hot-repo-radar/cache/translations.json",
  "leaderboardSize": 20,
  "retentionDays": 21,
  "requestTimeoutMs": 12000,
  "requestRetries": 3,
  "translationEnabled": true,
  "translationBatchSize": 4,
  "windows": ["daily", "weekly", "monthly"]
}
```

Legacy keys from older configs are still accepted when present.

## Layout

```text
hot-repo-radar/
|-- config.json
|-- scripts/
|   |-- runtime.js
|   |-- trending.js
|   |-- translation.js
|   |-- report.js
|   |-- fetch-trending.js
|   `-- generate-report.js
|-- references/
|   `-- report-format.md
|-- README.md
|-- README_CN.md
`-- SKILL.md
```

## License

MIT
