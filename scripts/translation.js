'use strict';

const path = require('path');
const { ensureDirectory, readJson, requestText, writeJson } = require('./runtime');

function looksChinese(text) {
  if (!text) {
    return false;
  }

  const matches = text.match(/[\u4e00-\u9fff]/g) || [];
  return matches.length >= 2 || matches.length / text.length >= 0.2;
}

function createTranslator(settings, options) {
  const enabled = options && Object.prototype.hasOwnProperty.call(options, 'enabled')
    ? Boolean(options.enabled)
    : settings.translationEnabled;

  let cache = null;

  function getCache() {
    if (!cache) {
      ensureDirectory(path.dirname(settings.translationCachePath));
      const loaded = readJson(settings.translationCachePath, {});
      cache = loaded && typeof loaded === 'object' && !Array.isArray(loaded) ? loaded : {};
    }

    return cache;
  }

  function saveCache() {
    if (cache) {
      writeJson(settings.translationCachePath, cache);
    }
  }

  async function translateOne(text) {
    if (!enabled || !text || looksChinese(text)) {
      return text;
    }

    const cacheStore = getCache();
    if (cacheStore[text]) {
      return cacheStore[text];
    }

    const params = new URLSearchParams({
      client: 'gtx',
      sl: 'en',
      tl: 'zh-CN',
      dt: 't',
      q: text,
    });

    try {
      const response = await requestText(
        `https://translate.googleapis.com/translate_a/single?${params.toString()}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          },
          timeoutMs: settings.requestTimeoutMs,
        },
        Math.min(2, settings.requestRetries)
      );

      const payload = JSON.parse(response);
      const translated = Array.isArray(payload[0])
        ? payload[0].map((chunk) => Array.isArray(chunk) ? chunk[0] : '').join('')
        : text;

      cacheStore[text] = translated || text;
      return cacheStore[text];
    } catch {
      return text;
    }
  }

  async function translateMany(values) {
    const results = values.slice();
    const pending = [];

    values.forEach((value, index) => {
      if (!enabled || !value || looksChinese(value)) {
        return;
      }

      const cacheStore = getCache();
      if (cacheStore[value]) {
        results[index] = cacheStore[value];
        return;
      }

      pending.push({ index, value });
    });

    for (let offset = 0; offset < pending.length; offset += settings.translationBatchSize) {
      const batch = pending.slice(offset, offset + settings.translationBatchSize);
      const translated = await Promise.all(batch.map((item) => translateOne(item.value)));

      translated.forEach((value, index) => {
        const target = batch[index];
        results[target.index] = value;
      });
    }

    if (pending.length) {
      saveCache();
    }

    return results;
  }

  async function attachSummaries(entries) {
    const summaries = entries.map((entry) => entry.summary || '');
    const translated = await translateMany(summaries);

    return entries.map((entry, index) => ({
      ...entry,
      summaryZh: translated[index] || entry.summary || '',
    }));
  }

  return {
    attachSummaries,
    translateMany,
  };
}

module.exports = {
  createTranslator,
};
