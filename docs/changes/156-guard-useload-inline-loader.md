# #156: guard useLoad against inline loader functions

## Purpose

`useLoad` listed `load` as an effect dependency, so a caller passing an inline function (`useLoad(id, (k) => api.get(k))`) would refetch on every render and could loop. All current callers pass stable functions, but nothing in the type or the comments said it was required.

## Changes

| File                                              | Change                                                                                              |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `frontend/src/use-load.ts`                        | The latest `load` is kept in a ref; the load effect depends only on `key`. The comment says so.     |
| `frontend/src/use-load.test.tsx`                  | Hook tests: an inline loader asks once per key across re-renders; a new key uses the latest loader. |
| `docs/changes/156-guard-useload-inline-loader.md` | This record                                                                                         |

## Verification

- `npm run check`: pass (52 test files, 346 passed, 3 skipped). DB integration tests skip locally (no PostgreSQL on this Mac) and run in CI.
- The new inline-loader test does not finish against the old `useLoad` (render loop); it passes with the fix.
- Browser check: not needed, no screen change.

## Limits

- `useReloading` still builds `loadKey` with `useCallback([load])`; that only changes identity and no longer triggers a load.
