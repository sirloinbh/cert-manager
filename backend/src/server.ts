import { Pool } from 'pg';

import { createApp } from './app.js';
import { listenHost, sharedAuth } from './standard/auth.js';
import { createPool } from './standard/db.js';

const port = Number(process.env.PORT ?? 3106);
// #139: fail fast with a clear message instead of a late connection error.
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const pool = createPool(new Pool({ connectionString: process.env.DATABASE_URL }));
// #139: an idle client error (for example a DB restart) is logged; without a listener it would crash Node.
pool.on('error', (error) => console.error('Idle database client error:', error.message));
// Without the sign-in (local development) the API listens on 127.0.0.1 only; with it, on every interface (#866, #898).
const auth = sharedAuth();
const server = createApp(pool, {
  auth,
  toolsPublicKey: process.env.AI_TOOLS_PUBLIC_KEY,
}).listen(port, listenHost(auth !== undefined), () => console.log(`API http://localhost:${port}`));
process.on('SIGTERM', () =>
  server.close(() => {
    void pool.end();
  }),
);
