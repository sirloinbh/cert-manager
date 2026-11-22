# #150 Move the offline scripts out of the server build

- 17 script files moved from `backend/src/` to `backend/src/scripts/` (`git mv`, history kept): the 8 entry points (`import-song-list`, `import-lyrics`, `export-translations`, `import-translations`, `import-word-list`, `import-etymology`, `export-words`, `import-words`) and `lyrics-fetch`, `polite-fetch`, `script-database`, `song-list`, `song-list-save`, `translation-files`, `word-etymology`, `word-files`, `word-list`. Relative imports and the `.local/` folder paths (one level deeper now) were rewritten; behavior is unchanged.
- `backend/src/lyrics-store.ts` stays in `src/`: `routes/songs.ts` imports it, so it is the small shared lyrics module the server needs. The server imports nothing from `scripts/`.
- `backend/tsconfig.build.json` (new) extends `tsconfig.json` and excludes `src/scripts`; the backend `build` script is now `tsc -p tsconfig.build.json`, so the production `dist/` has no script files. `tsconfig.json` and `tsconfig.check.json` are centrally managed and are unchanged, so type check and lint still cover the scripts.
- `backend/package.json`: the path strings of the 8 script commands changed (`src/...` to `src/scripts/...`), and `build` now points at `tsconfig.build.json`. No dependency, version or new script.
- Kept in `src/` on purpose: `migrate.ts` (the deploy runs `node dist/migrate.js`) and `openapi-cli.ts` (thin entry behind the managed `npm run openapi`).
- Tests under `backend/test/` only got new import paths.

## Checks

- `npm run check` passed: format, lint, contract, type check, build; backend 142 passed and 19 skipped, frontend 364 passed and 3 skipped, skills 4 passed.
- The 19 skipped backend tests are DB integration tests (no PostgreSQL on this Mac); CI runs them.
- `npm run build -w backend` (now `tsc -p tsconfig.build.json`): `backend/dist` has `server.js` and `migrate.js` and no script file (no `scripts/` folder, no import/export/word/lyrics-fetch/polite-fetch file).
- `node .standards/check.mjs` passes (the managed tsconfig files are unchanged).
- Each of the 8 npm commands (`songs:import`, `lyrics:import`, `translations:export`, `translations:import`, `words:import`, `words:etymology`, `words:export`, `words:fill`) starts and stops at `DATABASE_URL is not set` when run without a database, so the new paths load. I did not run them against a database (none on this Mac).
