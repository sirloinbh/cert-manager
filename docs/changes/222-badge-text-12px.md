# #222 Alert badge text at 12px

- Issue: [#222](https://github.com/sirloinbh/cert-manager/issues/222)
- Related: sirloinbh/project-standards#1135

The bell badge was `text-[0.625rem]` (10px); it is `text-xs` (12px). The badge grows from `h-4 min-w-4` to `h-5 min-w-5` so the text fits.

## Verification

- `npm run check`: see the PR.
