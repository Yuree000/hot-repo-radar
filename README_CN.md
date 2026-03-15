# hot-repo-radar

[English](./README.md) | 简体中文

这是一个零依赖的 GitHub Trending 观察器。它会把每日、每周、每月三个时间窗口的榜单抓取为快照，和更早的快照做对比，并输出一份偏简报风格的 Markdown 报告；如果开启翻译，还会把英文简介补成中文概览。

## 这一版的特点

- 默认工作目录改为 `~/.hot-repo-radar`
- 快照按日期分文件夹存放，便于归档和清理
- 抓取、翻译、报告渲染拆成独立模块
- 报告结构更偏“观察摘要 / 新进 / 离场 / 跃升”
- 只使用 Node.js 标准库，不需要安装 npm 依赖

## 快速开始

```bash
# 抓取今天的三个时间窗口
node scripts/fetch-trending.js

# 生成今天的简报
node scripts/generate-report.js
```

输出位置：

- 快照：`~/.hot-repo-radar/snapshots/YYYY-MM-DD/{window}.json`
- 报告：`~/.hot-repo-radar/reports/radar-YYYY-MM-DD.md`
- 翻译缓存：`~/.hot-repo-radar/cache/translations.json`

## 常用命令

```bash
# 只刷新指定日期的 daily 和 weekly 快照
node scripts/fetch-trending.js --date 2026-03-15 --only daily,weekly --refresh

# 生成不带翻译的英文简报
node scripts/generate-report.js --date 2026-03-15 --raw-language
```

## 配置项

根目录的 `config.json` 提供主要运行参数：

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

如果你本地还留着旧版配置键名，当前实现也会兼容读取。

## 项目结构

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

## 许可

MIT
