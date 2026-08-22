# Repository Guidelines

## Project Structure & Module Organization

This is a CommonJS Node.js tool for analyzing Google Discover headlines. `src/cli.js` is the command entry point and Express dashboard API. Other `src/` modules handle collection, classification, SQLite persistence, proxy rotation, scoring, and reports. `dashboard/` contains the interactive UI; `web/` contains static output. Keep generated databases and logs in ignored `data/` and `logs/`. Because `reports/` contains generated HTML and checked-in research notes, review its changes carefully.

## Build, Test, and Development Commands

- `npm ci` installs locked dependencies reproducibly.
- `Copy-Item config.example.json config.json` creates required local configuration on Windows.
- `npm run dashboard` starts the local dashboard (port `3100` in the example config).
- `npm run collect` performs a one-time external-data collection.
- `npm run analyze` prints analysis to the terminal.
- `npm run report` writes `reports/discover-report.html`.
- `node src/cli.js score "Example headline"` smoke-tests headline scoring.
- `npm start` launches the dashboard and six-hour collection loop through Bash.

## Coding Style & Naming Conventions

Match existing JavaScript: two-space indentation, semicolons, single quotes, `const` by default, and `async`/`await`. Use `camelCase` for functions and variables, `PascalCase` for classes, and kebab-case filenames such as `report-generator.js`. Keep CLI orchestration in `cli.js`; put reusable logic in focused modules. No formatter or linter is configured, so avoid formatting churn.

## Testing Guidelines

There is no automated test framework or coverage threshold. Run the affected CLI command and a scoring smoke test before submitting. For database or collection changes, use a disposable database path and confirm reports or dashboard endpoints still load. Do not make live proxy availability the only validation.

## Commit & Pull Request Guidelines

History uses Conventional Commit style, for example `feat: add topic lanes`. Use short, imperative subjects such as `fix: handle malformed RSS dates`. Pull requests should explain behavior changes, list validation commands, link issues, and include screenshots for dashboard or report changes. Call out schema, configuration, or external-service impacts.

## Security & Configuration

Never commit `config.json`, `proxies.txt`, credentials, database files, or logs. Add new settings to `config.example.json` with safe placeholders. Treat reset or bulk-load flags as data-affecting operations and document them clearly in review notes.
