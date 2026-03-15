# Snapshot and Briefing Reference

## Snapshot location

Each run writes one JSON file per window inside a dated folder:

```text
~/.hot-repo-radar/snapshots/YYYY-MM-DD/{window}.json
```

Example schema:

```json
{
  "schemaVersion": 2,
  "capturedOn": "2026-03-15",
  "capturedAt": "2026-03-15T08:00:00.000Z",
  "window": "daily",
  "source": {
    "kind": "github-trending-html",
    "url": "https://github.com/trending?since=daily"
  },
  "entries": [
    {
      "position": 1,
      "repo": "owner/repo",
      "url": "https://github.com/owner/repo",
      "summary": "Short repository description",
      "primaryLanguage": "TypeScript",
      "stars": 12345,
      "forks": 678,
      "velocity": 450,
      "velocityLabel": "today"
    }
  ]
}
```

## Briefing location

```text
~/.hot-repo-radar/reports/radar-YYYY-MM-DD.md
```

The markdown briefing is organized by window and contains:

1. Observation summary
2. Leaderboard table
3. New arrivals
4. Exit list
5. Strongest upward movers

## Translation cache

```text
~/.hot-repo-radar/cache/translations.json
```

This cache stores plain key-value pairs from original English summaries to translated Chinese text.
