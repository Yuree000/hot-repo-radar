#!/usr/bin/env node
'use strict';

const {
  ensureDirectory,
  latestAvailableBefore,
  loadSettings,
  normalizeDay,
  readJson,
  reportPath,
  snapshotPath,
  writeText,
} = require('./runtime');
const { compareSnapshots, renderMarkdownDocument } = require('./report');
const { createTranslator } = require('./translation');

function printHelp() {
  console.log([
    'Usage:',
    '  node scripts/generate-report.js [--date YYYY-MM-DD] [--only daily,weekly] [--raw-language]',
    '',
    'Flags:',
    '  --date          build a report for a specific snapshot day',
    '  --only          comma-separated windows: daily, weekly, monthly',
    '  --raw-language  keep English summaries and skip translation',
    '  --no-translate  alias of --raw-language',
    '  --help          show this message',
  ].join('\n'));
}

function parseArguments(argv) {
  const parsed = {
    day: null,
    rawLanguage: false,
    windows: null,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--help') {
      parsed.help = true;
      continue;
    }

    if (token === '--raw-language' || token === '--no-translate') {
      parsed.rawLanguage = true;
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

function loadSnapshot(settings, day, windowName) {
  return readJson(snapshotPath(settings.snapshotDir, day, windowName), null);
}

async function main() {
  const settings = loadSettings();
  const args = parseArguments(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const day = normalizeDay(args.day);
  const windows = normalizeWindows(args.windows, settings.windows);
  const translator = createTranslator(settings, {
    enabled: settings.translationEnabled && !args.rawLanguage,
  });

  ensureDirectory(settings.reportDir);

  const models = [];

  for (const windowName of windows) {
    const currentSnapshot = loadSnapshot(settings, day, windowName);
    if (!currentSnapshot) {
      console.warn(`  [${windowName}] snapshot missing for ${day}, skipping`);
      continue;
    }

    const baselineDay = latestAvailableBefore(settings.snapshotDir, day, windowName);
    const priorSnapshot = baselineDay ? loadSnapshot(settings, baselineDay, windowName) : null;

    console.log(`  [${windowName}] rendering${baselineDay ? ` against ${baselineDay}` : ' without baseline'}`);

    const currentEntries = await translator.attachSummaries(currentSnapshot.entries);
    const priorEntries = priorSnapshot ? await translator.attachSummaries(priorSnapshot.entries) : null;

    models.push(compareSnapshots(
      { ...currentSnapshot, entries: currentEntries },
      priorSnapshot ? { ...priorSnapshot, entries: priorEntries } : null
    ));
  }

  if (!models.length) {
    throw new Error(`No snapshots available for ${day}. Run fetch-trending first.`);
  }

  const output = renderMarkdownDocument(day, models, settings);
  const outputPath = reportPath(settings.reportDir, day);
  writeText(outputPath, output);

  console.log(`Report written to ${outputPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
