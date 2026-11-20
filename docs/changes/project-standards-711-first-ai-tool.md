# project-standards#711: the first AI tool and the audit_log table

## Purpose

shared-ai can now list this app's tools and call one of them. The tool is read-only: `list_certifications`. The
`audit_log` migration ships in the same change, because a tool call in an app without the table fails with "relation
does not exist". The recipe is `docs/conventions/first-ai-tool.md` in project-standards.

## Changes

| File                                                                    | Change                                                                                                                                         |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `database/migrations/010_audit_log.sql`                                 | The audit table, copied unchanged from the scaffold                                                                                            |
| `backend/src/routes/certifications.ts`                                  | The goal list moved out of the route into `listCertifications(db, limit?, current)`; the route calls it without a limit. Same SQL, same answer |
| `backend/src/ai-tools.ts`                                               | `list_certifications`: `limit` (default 50, at most 200). Returns `today` and the goals, the same fields as `GET /api/certifications`          |
| `backend/src/app.ts`, `backend/src/server.ts`                           | `registerToolRoutes` with `requireBinding: true`; `toolsPublicKey` from `AI_TOOLS_PUBLIC_KEY`                                                  |
| `compose.yaml`, `.env.example`                                          | `AI_TOOLS_PUBLIC_KEY`, the `shared-ai` network with the alias `cert-manager-api`, and the external network                                     |
| `backend/test/ai-tools.integration.test.ts`, `ai-tools-binding.test.ts` | Scope, signature, bad input, audit rows (`denied`, `ok`, `error`); no key means 404; unbound, wrong-tool and replayed tokens are 401           |

## Verification

- `eslint . --max-warnings 0`, `prettier --check .`, backend `tsc -p tsconfig.check.json`: pass.
- Backend tests against a throwaway PostgreSQL 17 with every migration applied: 137 pass, 0 fail, 0 skipped.
- Live check through shared-ai after the deploy: see the checklist on project-standards#711.

## Limits

- The app has no `docs/api.md`, so the note about `/internal/tools` lives here.
- Writes are not exposed; a write tool is a separate decision.
