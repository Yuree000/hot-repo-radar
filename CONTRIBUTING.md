# Contributing to hot-repo-radar

Thanks for your interest in contributing. This document covers how to report bugs, suggest features, and submit code changes.

## Reporting bugs

Open an issue using the **Bug Report** template. Please include:

- Your Node.js version (`node --version`)
- The exact command you ran
- The full error output or unexpected behavior
- Your OS

## Suggesting features

Open an issue using the **Feature Request** template. Describe the use case first — what problem does it solve, and why can't it be addressed with the current `config.json` options?

## Submitting a pull request

1. Fork the repository and create a branch from `main`
2. Make your changes — keep the scope focused, one thing per PR
3. Test manually:
   ```bash
   node scripts/fetch-trending.js --force
   node scripts/generate-report.js
   ```
4. Make sure no external npm dependencies are introduced — this project intentionally uses only the Node.js standard library
5. Open a PR with a clear title and description of what changed and why

## Code style

- English comments only
- No external dependencies
- Keep functions small and single-purpose
- Match the existing code style in the file you're editing

## Questions

Open a GitHub Discussion if you have questions that aren't bugs or feature requests.
