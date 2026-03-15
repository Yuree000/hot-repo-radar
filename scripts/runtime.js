'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const DEFAULT_WINDOWS = ['daily', 'weekly', 'monthly'];
const DEFAULT_SETTINGS = {
  workspaceDir: path.join(os.homedir(), '.hot-repo-radar'),
  snapshotDir: path.join(os.homedir(), '.hot-repo-radar', 'snapshots'),
  reportDir: path.join(os.homedir(), '.hot-repo-radar', 'reports'),
  translationCachePath: path.join(os.homedir(), '.hot-repo-radar', 'cache', 'translations.json'),
  leaderboardSize: 20,
  retentionDays: 21,
  requestTimeoutMs: 12000,
  requestRetries: 3,
  translationEnabled: true,
  translationBatchSize: 4,
  windows: DEFAULT_WINDOWS,
  baseUrl: 'https://github.com/trending',
};

const LEGACY_ALIASES = {
  dataDir: 'snapshotDir',
  cacheFile: 'translationCachePath',
  topN: 'leaderboardSize',
  keepDays: 'retentionDays',
  requestTimeout: 'requestTimeoutMs',
  maxRetries: 'requestRetries',
  translateConcurrency: 'translationBatchSize',
};

function expandHome(value) {
  if (typeof value === 'string' && value.startsWith('~')) {
    return path.join(os.homedir(), value.slice(1));
  }
  return value;
}

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeWindows(input) {
  const values = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(',')
      : DEFAULT_WINDOWS;

  const cleaned = values
    .map((item) => String(item).trim().toLowerCase())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .filter((item) => DEFAULT_WINDOWS.includes(item));

  return cleaned.length ? cleaned : DEFAULT_WINDOWS.slice();
}

function applyLegacyAliases(rawConfig) {
  const merged = { ...rawConfig };

  Object.keys(LEGACY_ALIASES).forEach((legacyKey) => {
    const nextKey = LEGACY_ALIASES[legacyKey];
    if (merged[nextKey] == null && merged[legacyKey] != null) {
      merged[nextKey] = merged[legacyKey];
    }
  });

  return merged;
}

function loadSettings() {
  let rawConfig = {};

  if (fs.existsSync(CONFIG_PATH)) {
    try {
      rawConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (error) {
      console.warn(`Warning: failed to parse config.json, using defaults. (${error.message})`);
    }
  }

  const merged = {
    ...DEFAULT_SETTINGS,
    ...applyLegacyAliases(rawConfig),
  };

  merged.workspaceDir = expandHome(merged.workspaceDir);
  merged.snapshotDir = expandHome(merged.snapshotDir);
  merged.reportDir = expandHome(merged.reportDir);
  merged.translationCachePath = expandHome(merged.translationCachePath);
  merged.leaderboardSize = toPositiveInteger(merged.leaderboardSize, DEFAULT_SETTINGS.leaderboardSize);
  merged.retentionDays = toPositiveInteger(merged.retentionDays, DEFAULT_SETTINGS.retentionDays);
  merged.requestTimeoutMs = toPositiveInteger(merged.requestTimeoutMs, DEFAULT_SETTINGS.requestTimeoutMs);
  merged.requestRetries = toPositiveInteger(merged.requestRetries, DEFAULT_SETTINGS.requestRetries);
  merged.translationBatchSize = toPositiveInteger(merged.translationBatchSize, DEFAULT_SETTINGS.translationBatchSize);
  merged.translationEnabled = Boolean(merged.translationEnabled);
  merged.windows = normalizeWindows(merged.windows);

  return merged;
}

function ensureDirectory(targetPath) {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
}

function readJson(filepath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filepath, payload) {
  ensureDirectory(path.dirname(filepath));
  fs.writeFileSync(filepath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function writeText(filepath, payload) {
  ensureDirectory(path.dirname(filepath));
  fs.writeFileSync(filepath, payload, 'utf8');
}

function isoDay(dateLike) {
  const value = dateLike instanceof Date ? dateLike : new Date(dateLike || Date.now());
  return value.toISOString().slice(0, 10);
}

function normalizeDay(input) {
  if (!input) {
    return isoDay(new Date());
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw new Error(`Invalid date: ${input}. Use YYYY-MM-DD.`);
  }

  return input;
}

function snapshotFolder(snapshotDir, day) {
  return path.join(snapshotDir, day);
}

function snapshotPath(snapshotDir, day, windowName) {
  return path.join(snapshotFolder(snapshotDir, day), `${windowName}.json`);
}

function reportPath(reportDir, day) {
  return path.join(reportDir, `radar-${day}.md`);
}

function listSnapshotDays(snapshotDir) {
  if (!fs.existsSync(snapshotDir)) {
    return [];
  }

  return fs.readdirSync(snapshotDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function latestAvailableBefore(snapshotDir, day, windowName) {
  const days = listSnapshotDays(snapshotDir).filter((candidate) => candidate < day).reverse();

  for (const candidate of days) {
    if (!windowName || fs.existsSync(snapshotPath(snapshotDir, candidate, windowName))) {
      return candidate;
    }
  }

  return null;
}

function removeDirectoryTree(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  fs.readdirSync(targetPath, { withFileTypes: true }).forEach((entry) => {
    const fullPath = path.join(targetPath, entry.name);

    if (entry.isDirectory()) {
      removeDirectoryTree(fullPath);
      return;
    }

    fs.unlinkSync(fullPath);
  });

  fs.rmdirSync(targetPath);
}

function pruneSnapshotDays(snapshotDir, retentionDays) {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  const earliestDay = isoDay(cutoff);
  const removed = [];

  listSnapshotDays(snapshotDir).forEach((day) => {
    if (day >= earliestDay) {
      return;
    }

    removeDirectoryTree(snapshotFolder(snapshotDir, day));
    removed.push(day);
  });

  return removed;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestTextOnce(targetUrl, options, redirectsLeft) {
  return new Promise((resolve, reject) => {
    const request = https.get(targetUrl, { headers: options.headers || {} }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const nextUrl = new URL(response.headers.location, targetUrl).toString();
        response.resume();

        if (redirectsLeft <= 0) {
          reject(new Error(`Too many redirects while requesting ${targetUrl}`));
          return;
        }

        requestTextOnce(nextUrl, options, redirectsLeft - 1).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`HTTP ${response.statusCode} for ${targetUrl}`));
        return;
      }

      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => resolve(body));
      response.on('error', reject);
    });

    request.on('error', reject);
    request.setTimeout(options.timeoutMs, () => {
      request.destroy(new Error(`Request timed out after ${options.timeoutMs}ms: ${targetUrl}`));
    });
  });
}

async function requestText(targetUrl, options, retries) {
  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await requestTextOnce(targetUrl, options, 5);
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        break;
      }

      const delay = Math.min(500 * (2 ** (attempt - 1)), 4000);
      console.warn(`  request retry ${attempt}/${retries - 1}: ${error.message}; waiting ${delay}ms`);
      await sleep(delay);
    }
  }

  throw lastError;
}

module.exports = {
  DEFAULT_WINDOWS,
  ensureDirectory,
  isoDay,
  latestAvailableBefore,
  listSnapshotDays,
  loadSettings,
  normalizeDay,
  pruneSnapshotDays,
  readJson,
  reportPath,
  requestText,
  snapshotFolder,
  snapshotPath,
  writeJson,
  writeText,
};
