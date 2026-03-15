'use strict';

const { requestText } = require('./runtime');

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'text/html',
  'Accept-Language': 'en-US,en;q=0.9',
};

const ENTITY_REPLACEMENTS = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(input) {
  return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const lower = entity.toLowerCase();

    if (ENTITY_REPLACEMENTS[lower]) {
      return ENTITY_REPLACEMENTS[lower];
    }

    if (lower.startsWith('#x')) {
      return String.fromCharCode(Number.parseInt(lower.slice(2), 16));
    }

    if (lower.startsWith('#')) {
      return String.fromCharCode(Number.parseInt(lower.slice(1), 10));
    }

    return match;
  });
}

function plainText(fragment) {
  return decodeEntities(fragment.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumber(input) {
  const digits = String(input || '').replace(/[^\d]/g, '');
  return digits ? Number.parseInt(digits, 10) : 0;
}

function firstMatch(source, patterns) {
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return '';
}

function collectCards(html) {
  return html
    .split('<article class="Box-row">')
    .slice(1)
    .map((chunk) => chunk.split('</article>')[0])
    .filter(Boolean);
}

function readLinkedCounter(card, suffix) {
  const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = card.match(new RegExp(`<a[^>]+href="/[^"]+${escaped}"[^>]*>([\\s\\S]*?)<\\/a>`, 'i'));
  return parseNumber(plainText(match ? match[1] : ''));
}

function readVelocity(card) {
  const match = card.match(/([\d,]+)\s+stars\s+(today|this week|this month)/i);
  if (!match) {
    return { value: 0, label: '' };
  }

  return {
    value: parseNumber(match[1]),
    label: match[2].toLowerCase(),
  };
}

function parseCard(card, position) {
  const repo = plainText(firstMatch(card, [
    /<h2[^>]*>[\s\S]*?<a[^>]+href="\/([^"]+\/[^"]+)"[^>]*>/i,
    /href="\/([^"]+\/[^"]+)"[^>]*data-view-component=/i,
  ]));

  if (!repo) {
    return null;
  }

  const summary = plainText(firstMatch(card, [
    /<p\b[^>]*>([\s\S]*?)<\/p>/i,
  ]));

  const primaryLanguage = plainText(firstMatch(card, [
    /itemprop="programmingLanguage"[^>]*>([\s\S]*?)<\/span>/i,
  ]));

  const velocity = readVelocity(card);

  return {
    position,
    repo,
    url: `https://github.com/${repo}`,
    summary,
    primaryLanguage,
    stars: readLinkedCounter(card, '/stargazers'),
    forks: readLinkedCounter(card, '/forks'),
    velocity: velocity.value,
    velocityLabel: velocity.label,
  };
}

async function fetchWindowSnapshot(windowName, settings, day) {
  const targetUrl = `${settings.baseUrl}?since=${windowName}`;
  const html = await requestText(targetUrl, {
    headers: BROWSER_HEADERS,
    timeoutMs: settings.requestTimeoutMs,
  }, settings.requestRetries);

  const entries = collectCards(html)
    .map((card, index) => parseCard(card, index + 1))
    .filter(Boolean);

  return {
    schemaVersion: 2,
    capturedOn: day,
    capturedAt: new Date().toISOString(),
    window: windowName,
    source: {
      kind: 'github-trending-html',
      url: targetUrl,
    },
    entries,
  };
}

module.exports = {
  fetchWindowSnapshot,
};
