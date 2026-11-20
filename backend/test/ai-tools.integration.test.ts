import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { test } from 'node:test';

import { Pool } from 'pg';

import { createApp } from '../src/app.js';
import { listenLocally, withApi } from './helpers.js';

// project-standards#711: shared-ai calls the first AI tool with a signed token; each call is checked for its scope
// and leaves one audit_log row.
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
// One owner per run, so the audit rows of an earlier run on the same DB do not count.
const owner = `owner-${randomUUID()}`;
// A token names its tool ('@list' for the list) and has its own jti; the app requires both (#670, #822).
function token(scope: string, tool: string, key = privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: 'EdDSA', typ: 'JWT' })}.${b64({ iss: 'shared-ai', aud: 'cert-manager', sub: owner, client: 'stdio', scope, tool, jti: randomUUID(), iat: now, exp: now + 60 })}`;
  return `${body}.${sign(null, Buffer.from(body), key).toString('base64url')}`;
}

test(
  'AI tools: list certification goals with scopes, signatures and audit rows',
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const sql = await readFile(
      new URL('../../database/migrations/010_audit_log.sql', import.meta.url),
      'utf8',
    );
    await pool.query(sql);
    const toolsPublicKey = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const name = `AI-${randomUUID()}`;
    let goalId: number | undefined;
    try {
      await withApi(
        pool,
        async (call) => {
          const created = await call('/api/certifications', {
            method: 'POST',
            body: { name, category: 'dev', status: 'studying', validityKind: 'none' },
          });
          assert.equal(created.status, 201);
          goalId = (created.data.certification as { id: number }).id;
          const tool = (auth: string | null, body: unknown = {}) =>
            call('/internal/tools/list_certifications', {
              method: 'POST',
              body,
              headers: auth ? { authorization: `Bearer ${auth}` } : {},
            });
          const read = () => token('cert-manager:read', 'list_certifications');

          const listed = await call('/internal/tools', {
            headers: { authorization: `Bearer ${token('cert-manager:read', '@list')}` },
          });
          assert.equal(listed.status, 200);
          assert.deepEqual(
            (listed.data.tools as { name: string; annotations: { readOnlyHint: boolean } }[]).map(
              (t) => [t.name, t.annotations.readOnlyHint],
            ),
            [['list_certifications', true]],
          );

          assert.equal((await tool(null)).status, 401);
          const otherKey = generateKeyPairSync('ed25519').privateKey;
          assert.equal(
            (await tool(token('cert-manager:read', 'list_certifications', otherKey))).status,
            401,
          );
          assert.equal(
            (await tool(token('cert-manager:other', 'list_certifications'))).status,
            403,
          );

          const ok = await tool(read(), { limit: 200 });
          assert.equal(ok.status, 200);
          const result = ok.data.result as {
            today: string;
            certifications: { id: number; name: string }[];
          };
          assert.equal(result.certifications.find((c) => c.id === goalId)?.name, name);
          assert.match(result.today, /^\d{4}-\d{2}-\d{2}$/);
          assert.equal((await tool(read(), { limit: 0 })).status, 400);
        },
        { toolsPublicKey },
      );

      const rows = (
        await pool.query(
          "SELECT action,result,entity,tool,client,actor_type FROM audit_log WHERE actor_type='ai-tool' AND actor_id=$1 ORDER BY id",
          [owner],
        )
      ).rows;
      assert.deepEqual(
        rows.map((r) => [r.tool, r.action, r.result]),
        [
          ['list_certifications', 'read', 'denied'],
          ['list_certifications', 'read', 'ok'],
          ['list_certifications', 'read', 'error'],
        ],
      );
      assert.equal(rows[1].client, 'stdio');
      assert.equal(rows[1].entity, 'certification');
    } finally {
      if (goalId !== undefined)
        await pool.query('DELETE FROM certifications WHERE id = $1', [goalId]);
      await pool.end();
    }
  },
);

test(
  'AI tools are off without the shared-ai public key',
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const server = createServer(createApp(pool));
    const port = await listenLocally(server);
    try {
      assert.equal((await fetch(`http://127.0.0.1:${port}/internal/tools`)).status, 404);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await pool.end();
    }
  },
);
