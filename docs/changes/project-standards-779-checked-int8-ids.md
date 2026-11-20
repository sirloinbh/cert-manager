# Checked int8 parser; ids are selected as they are (project-standards#779)

- `app.ts` calls `setInt8Parser(types)` from `standard/db.ts`: BIGINT ids come back as numbers and throw above 2^53.
- Removed the 19 `id::text` casts and the `toId` conversions, and the row mapper functions that only called `toId`.
- Row types use `number` for ids. The API output does not change (ids were already numbers on the wire).
- Convention: `docs/conventions/pg-ids-and-rows.md` in sirloinbh/project-standards (ADR-0025).
- Verification: `npm run typecheck`, `npm run lint`, prettier. Integration tests need Postgres and run in CI.
