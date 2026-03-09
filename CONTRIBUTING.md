# Contributing to rs-trader

Thanks for your interest in contributing. This project follows **test-driven development** and keeps docs in the repo.

## Getting started

1. **Fork and clone** the repo.
2. **Install dependencies:** `npm install`
3. **Run tests:** `npm test` (or `npm run test:watch` while coding)
4. **Read the docs:** [README.md](./README.md), [TDD.md](./TDD.md), [SETTINGS.md](./SETTINGS.md)

## Development workflow

- **TDD:** Write a failing test first, then implement the minimum code to pass, then refactor. See [TDD.md](./TDD.md).
- **Tests:** Use Node’s built-in test runner (`node --test`). Test files live under `tests/` and mirror `src/` structure.
- **Style:** Match existing code (ES modules, async/await, descriptive names). No formal linter required; keep changes small and focused.

## Pull requests

- **Scope:** One logical change per PR (e.g. one feature or one bugfix).
- **Tests:** New behavior should have tests; existing tests must stay green.
- **Docs:** Update README or other `.md` files if you change setup, config, or behavior.
- **Description:** Briefly explain what and why; link any related issue.

## Reporting issues

- **Bug:** Describe what you did, what you expected, and what happened. Include Node version and relevant config (redact secrets if any).
- **Feature:** Describe the use case and how you’d expect it to work.

## Code of conduct

Be respectful and constructive. This is a hobby project; we’re here to learn and share.
