#!/usr/bin/env node
'use strict';

const fs = require('fs');
const {
  ensureDirectory,
  loadSettings,
  normalizeDay,
  pruneSnapshotDays,
  snapshotPath,
  writeJson,
} = require('./runtime');
const { fetchWindowSnapshot } = require('./trending');

function printHelp() {
  console.log([
    'Usage:',
    '  node scripts/fetch-trending.js [--date YYYY-MM-DD] [--only daily,weekly] [--refresh]',
    '',
    'Flags:',
    '  --date      store the snapshot under a specific day',
    '  --only      comma-separated windows: daily, weekly, monthly',
    '  --refresh   overwrite an existing snapshot for the same day',
    '  --force     alias of --refresh',
    '  --help      show this message',
  ].join('\n'));
}

function parseArguments(argv) {
  const parsed = {
    day: null,
    refresh: false,
    windows: null,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--help') {
      parsed.help = true;
      continue;
    }

    if (token === '--refresh' || token === '--force') {
      parsed.refresh = true;
      continue;
    }

    if (token === '--date') {
      index += 1;
      parsed.day = argv[index];
      continue;
    }

    if (token === '--only') {
      index += 1;
      parsed.windows = argv[index];
      continue;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(token) && !parsed.day) {
      parsed.day = token;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return parsed;
}

function normalizeWindows(input, fallback) {
  if (!input) {
    return fallback.slice();
  }

  const items = String(input)
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const unique = items.filter((item, index) => items.indexOf(item) === index);
  const invalid = unique.filter((item) => !fallback.includes(item));

  if (invalid.length) {
    throw new Error(`Unsupported windows: ${invalid.join(', ')}`);
  }

  return unique.length ? unique : fallback.slice();
}

async function main() {
  const settings = loadSettings();
  const args = parseArguments(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const day = normalizeDay(args.day);
  const targetWindows = normalizeWindows(args.windows, settings.windows);

  ensureDirectory(settings.snapshotDir);

  console.log(`Preparing snapshots for ${day}`);
  console.log(`Windows: ${targetWindows.join(', ')}`);

  const results = await Promise.allSettled(targetWindows.map(async (windowName) => {
    const outputPath = snapshotPath(settings.snapshotDir, day, windowName);

    if (!args.refresh && fs.existsSync(outputPath)) {
      console.log(`  [${windowName}] existing snapshot found, skipping`);
      return { windowName, skipped: true };
    }

    console.log(`  [${windowName}] requesting GitHub Trending`);
    const snapshot = await fetchWindowSnapshot(windowName, settings, day);
    writeJson(outputPath, snapshot);
    console.log(`  [${windowName}] saved ${snapshot.entries.length} entries`);
    return { windowName, count: snapshot.entries.length };
  }));

  const failures = [];
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      failures.push(targetWindows[index]);
      console.error(`  [${targetWindows[index]}] failed: ${result.reason.message}`);
    }
  });

  const removed = pruneSnapshotDays(settings.snapshotDir, settings.retentionDays);
  if (removed.length) {
    console.log(`Removed expired snapshot folders: ${removed.join(', ')}`);
  }

  if (failures.length) {
    process.exitCode = 1;
    return;
  }

  console.log(`Snapshots ready in ${settings.snapshotDir}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
