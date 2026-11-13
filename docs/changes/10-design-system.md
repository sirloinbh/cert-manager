# #10 Switch the screens to the common design system

- Issue: [#10](https://github.com/sirloinbh/english-study/issues/10) (central tracking issue sirloinbh/project-standards#126)
- Branch: `feat/10-design-system`

## Purpose

The 8 apps decided to use the same tokens, components, layout, and PWA settings (central ADR-0007, ADR-0008). The method followed "Converting an existing app" in the central `docs/design-system.md` (workout-memo#160 applied it first).

## Changes: 2026-10-26

### Packages

The user installed them directly. They are the packages in the central ADR-0007 table (pre-approved 2026-10-22) and react-router, vitest, jsdom, and Testing Library (approved 2026-10-26). All have pinned versions, were published at least 14 days earlier, and use `--ignore-scripts`.

- dependencies: `@sirloinbh/design-tokens` 1.0.0, `class-variance-authority` 0.7.1, `clsx` 2.1.1, `radix-ui` 1.7.0, `react-router` 8.4.0, `sonner` 2.0.8, `tailwind-merge` 3.7.0, `tw-animate-css` 1.4.0, `vaul` 1.1.2, `lucide-react` 0.468.0 → 1.52.0
- devDependencies: `tailwindcss`·`@tailwindcss/vite` 4.3.3, `vitest` 5.0.3, `jsdom` 30.1.2, `@testing-library/react` 16.3.3, `@testing-library/dom` 10.4.2, `@testing-library/jest-dom` 7.0.1
- Two lockfiles (root, `frontend/`): no packages removed, and `lucide-react` is the only one whose version changed. All new entries come from the official registry, have integrity values, and have no install scripts. `ioc-scan`: no suspicious items

### Shared files (centrally managed)

These are exactly what came out of the sync preview where the center turned on `features.ui` and `features.vitest` for this app: 15 files in `frontend/src/components/ui/` with their tests, `components/layout/`, `lib/utils.ts` and `theme.ts`, `public/theme-init.js`, and `frontend/vitest.config.ts`.

### App code

- **Screens:** replaced the own shell (sidebar and header) with `AppShell` and added page addresses (`/`, `/settings`). Deleted the own `style.css` and use the shared tokens and `EmptyState`.
- **Entry points:** `app.tsx` (screens), `main.tsx` (rendering, and service worker registration only in the production build), `index.css` (Tailwind, `tw-animate-css`, shared tokens).
- **PWA:** 4 icons (the central `scripts/pwa-icons.mjs`), and in `index.html` the manifest, icons, light and dark `theme-color`, `viewport-fit=cover`, and the flash prevention script.
- **Tests and build:** added a `test` (vitest) script and `src/test/setup.ts` to `frontend`, and the root `npm test` also runs the frontend tests. The production build leaves out test files with `tsconfig.build.json`. Added the Tailwind plugin to `vite.config.ts`.
- **Removed the screen test in the backend:** `backend/test/app-ui.test.ts` was a temporary test that ran `main.tsx` with a fake React when Vitest was not available. The frontend Vitest test checks the same things (title, server status, error alert, menu navigation) with the real React, so it was deleted.
- **Screen test (`app.test.tsx`):** shows the server date, the server error alert, page navigation by menu and the current page display, and handling of an unknown address.

## Verification

- Prettier, ESLint, `tsc` (all), 40 frontend tests pass, `vite build`, `ioc-scan`
- The backend tests need a DB, so they are confirmed in CI.

## Verification supplement: 2026-10-29 ([#20](https://github.com/sirloinbh/english-study/issues/20))

Filled in after the fact the full `npm run check` result and the real browser check that were missing when PR #11 was merged. The main at the time of the check had central standards syncs after #11 (#12, #13, #16, #17, and #18 for the browser check) and security update #14 added, so it is not exactly the same as the screen right after #11.

- `npm run check` (Node 24.21.0 / npm 11.19.0, main `0f1f171`): pass. Of 5 backend tests, 4 passed and 1 was skipped (the DB integration test was skipped because `TEST_DATABASE_URL` was not set, and it is not counted as success). Frontend Vitest 20 files and 52 tests passed. 4 skill tests passed. The build succeeded.
- Browser check (main `3e56615`): started a temporary PostgreSQL 17 container (migration `001` applied) and the API and Vite servers from `npm run dev`, and opened `/` and `/settings` with the installed Chrome headless, setting the screen size through the DevTools protocol.

| Screen | Size     | Result                                                                                                                                                    |
| ------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile | 390×844  | No overflow (document width 390). Menu and theme buttons in the header, "서버 연결됨 · 2026-10-29" ("Server connected") and the empty-state message shown |
| PC     | 1440×900 | No overflow. The current page is highlighted in the sidebar, theme button in the header, server status, and empty-state message shown                     |

- Observation: on mobile the empty-state message breaks in the middle of a word, as in "추가합니 / 다." (Korean text split mid-word). `EmptyState` is a centrally managed file, but it can be fixed with `className` in the caller `app.tsx`, so I split it into [#22](https://github.com/sirloinbh/english-study/issues/22).
- Limit: with only the Chrome window size option (`--window-size`), the headless window had a minimum of 504px, so the 390px check was not possible. So I checked again with the DevTools protocol screen size override (`Emulation.setDeviceMetricsOverride`). I did not check dark mode or opening the menu.
