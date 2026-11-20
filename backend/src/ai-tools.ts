// The first AI tool of Cert Manager (project-standards#711, ADR-0017). shared-ai lists and calls it over
// /internal/tools; standard/tools.ts checks the signed call, the scope, and writes the audit row.
import type { Pool } from 'pg';
import { z } from 'zod/v4';

import { listCertifications } from './routes/certifications.js';
import { defineTool } from './standard/tools.js';

type Db = Pick<Pool, 'query'>;

// The goals are listed in the route's order; a call returns at most one page, never the whole table.
const listInput = z.object({ limit: z.number().int().min(1).max(200).default(50) });

export const tools = [
  defineTool({
    name: 'list_certifications',
    description:
      'List the certification goals, grouped by category (english, dev, life) and then by the nearest target exam date: name, status, goal, target score or grade, exam date, days until the exam, validity and memo. `limit` is the most goals returned (default 50, at most 200).',
    input: listInput,
    access: 'read',
    action: 'read',
    entity: 'certification',
    run: async ({ limit }, { db }: { db: Db }) => ({
      result: await listCertifications(db, limit),
    }),
  }),
];
