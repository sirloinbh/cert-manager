# #150 Move the offline scripts out of the server build

- 17 script files moved from `backend/src/` to `backend/src/scripts/` (`git mv`, history kept): the 8 entry points (`import-song-list`, `import-lyrics`, `export-translations`, `import-translations`, `import-word-list`, `import-etymology`, `export-words`, `import-words`) and `lyrics-fetch`, `polite-fetch`, `script-database`, `song-list`, `song-list-save`, `translation-files`, `word-etymology`, `word-files`, `word-list`. Relative imports and the `.local/` folder paths (one level deeper now) were rewritten; behavior is unchanged.
- `backend/src/lyrics-store.ts` stays in `src/`: `routes/songs.ts` imports it, so it is the small shared lyrics module the server needs. The server imports nothing from `scripts/`.
- `backend/tsconfig.json` excludes `src/scripts`, so the production `dist/` has no script files. `backend/tsconfig.check.json` still type-checks `src` (scripts included) and `test`.
- `backend/package.json`: only the path strings of the 8 script commands changed (`src/...` to `src/scripts/...`). No dependency, version or new script.
- Kept in `src/` on purpose: `migrate.ts` (the deploy runs `node dist/migrate.js`) and `openapi-cli.ts` (thin entry behind the managed `npm run openapi`).
- Tests under `backend/test/` only got new import paths.

## Checks

- `npm run check` passed: format, lint, contract, type check, build; backend 142 passed and 19 skipped, frontend 364 passed and 3 skipped, skills 4 passed.
- The 19 skipped backend tests are DB integration tests (no PostgreSQL on this Mac); CI runs them.
- Built `tsc -p tsconfig.json` into a scratch folder: the output has no script files and only `server`, `app`, `routes/`, `migrate`, `openapi*`, `lyrics-store` and the other server modules.
- Each of the 8 npm commands (`songs:import`, `lyrics:import`, `translations:export`, `translations:import`, `words:import`, `words:etymology`, `words:export`, `words:fill`) starts and stops at `DATABASE_URL is not set` when run without a database, so the new paths load. I did not run them against a database (none on this Mac).
- `backend/src/scripts/tsconfig.json`: ESLint finds the nearest `tsconfig.json` for a file, and the build config now excludes the scripts. This small config includes them (no emit) so lint still type-checks the scripts. It is not used by `tsc` for the build.
