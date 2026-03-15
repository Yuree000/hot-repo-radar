'use strict';

const WINDOW_TITLES = {
  daily: '日度雷达',
  weekly: '周度雷达',
  monthly: '月度雷达',
};

const VELOCITY_LABELS = {
  today: '今日新增',
  'this week': '本周新增',
  'this month': '本月新增',
};

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return '-';
  }

  return value.toLocaleString('en-US');
}

function labelMovement(movement) {
  if (movement.kind === 'fresh') {
    return '新入榜';
  }

  if (movement.kind === 'up') {
    return `上升 ${movement.delta}`;
  }

  if (movement.kind === 'down') {
    return `下降 ${movement.delta}`;
  }

  return '持平';
}

function velocityText(entry) {
  if (!entry.velocity) {
    return '-';
  }

  return `${formatNumber(entry.velocity)} / ${VELOCITY_LABELS[entry.velocityLabel] || entry.velocityLabel || '周期新增'}`;
}

function compareSnapshots(currentSnapshot, priorSnapshot) {
  const priorEntries = priorSnapshot ? priorSnapshot.entries : [];
  const priorPositions = new Map(priorEntries.map((entry) => [entry.repo, entry.position]));

  const entries = currentSnapshot.entries.map((entry) => {
    const priorPosition = priorPositions.get(entry.repo);

    if (!priorPosition) {
      return {
        ...entry,
        movement: { kind: 'fresh', delta: 0 },
      };
    }

    if (priorPosition > entry.position) {
      return {
        ...entry,
        movement: { kind: 'up', delta: priorPosition - entry.position },
      };
    }

    if (priorPosition < entry.position) {
      return {
        ...entry,
        movement: { kind: 'down', delta: entry.position - priorPosition },
      };
    }

    return {
      ...entry,
      movement: { kind: 'same', delta: 0 },
    };
  });

  const currentRepos = new Set(currentSnapshot.entries.map((entry) => entry.repo));
  const exited = priorEntries.filter((entry) => !currentRepos.has(entry.repo));

  const strongestMoves = entries
    .filter((entry) => entry.movement.kind === 'up')
    .sort((left, right) => {
      if (right.movement.delta !== left.movement.delta) {
        return right.movement.delta - left.movement.delta;
      }

      return left.position - right.position;
    })
    .slice(0, 5);

  return {
    window: currentSnapshot.window,
    currentDay: currentSnapshot.capturedOn,
    priorDay: priorSnapshot ? priorSnapshot.capturedOn : null,
    entries,
    exited,
    strongestMoves,
    summary: {
      fresh: entries.filter((entry) => entry.movement.kind === 'fresh').length,
      up: entries.filter((entry) => entry.movement.kind === 'up').length,
      down: entries.filter((entry) => entry.movement.kind === 'down').length,
      same: entries.filter((entry) => entry.movement.kind === 'same').length,
    },
  };
}

function renderTable(entries, limit) {
  const lines = [
    '| 位次 | 动向 | 项目 | 累计 Star | 周期增量 | 语言 | 中文概览 |',
    '|---|---|---|---|---|---|---|',
  ];

  entries.slice(0, limit).forEach((entry) => {
    const overview = (entry.summaryZh || entry.summary || '-').replace(/\|/g, '/').slice(0, 72);
    lines.push(`| ${entry.position} | ${labelMovement(entry.movement)} | [${entry.repo}](${entry.url}) | ${formatNumber(entry.stars)} | ${velocityText(entry)} | ${entry.primaryLanguage || '-'} | ${overview} |`);
  });

  return lines.join('\n');
}

function renderFocusList(entries, formatter) {
  if (!entries.length) {
    return '_无_\n';
  }

  return `${entries.map((entry) => formatter(entry)).join('\n')}\n`;
}

function renderWindowBlock(model, settings) {
  const title = WINDOW_TITLES[model.window] || model.window;
  const lines = [
    `## ${title}`,
    '',
    model.priorDay
      ? `参考基线：${model.priorDay}`
      : '参考基线：暂无更早快照',
    '',
    '### 观察摘要',
    '',
    `- 新入榜 ${model.summary.fresh} 个`,
    `- 上升 ${model.summary.up} 个`,
    `- 下降 ${model.summary.down} 个`,
    `- 持平 ${model.summary.same} 个`,
    '',
    '### 榜单概览',
    '',
    renderTable(model.entries, settings.leaderboardSize),
    '',
    '### 新进观察',
    '',
    renderFocusList(
      model.entries.filter((entry) => entry.movement.kind === 'fresh'),
      (entry) => `- **[${entry.repo}](${entry.url})** ${entry.primaryLanguage ? `(${entry.primaryLanguage})` : ''} ${entry.summaryZh || entry.summary || ''}`.trim()
    ),
    '### 离场名单',
    '',
    renderFocusList(
      model.exited,
      (entry) => `- ~~${entry.repo}~~ 上次位于第 ${entry.position} 名`
    ),
    '### 跃升最快',
    '',
    renderFocusList(
      model.strongestMoves,
      (entry) => `- **[${entry.repo}](${entry.url})** 上升 ${entry.movement.delta} 名`
    ),
  ];

  return lines.join('\n');
}

function renderMarkdownDocument(day, models, settings) {
  const sections = models.map((model) => renderWindowBlock(model, settings));

  return [
    '# Hot Repo Radar 简报',
    '',
    `目标日期：${day}`,
    `生成时间：${new Date().toISOString()}`,
    '',
    ...sections.join('\n\n---\n\n').split('\n'),
    '',
  ].join('\n');
}

module.exports = {
  compareSnapshots,
  renderMarkdownDocument,
};
