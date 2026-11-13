# #66 Revert the cn() workaround in the dashboard card

- `frontend/src/study-plan.tsx`: reverted the `className` of the days-left text to `cn()` and deleted the workaround comment.
- The central `cn()` fix (sirloinbh/project-standards#357) came in with #63, so `text-body-sm` is no longer removed.
