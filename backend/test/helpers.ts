import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { Pool } from 'pg';

import { createApp } from '../src/app.js';

// Ports above 1023 that fetch refuses. Windows can hand these out, and then a request fails with "bad port".
const refusedPorts = new Set([
  1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669,
  6679, 6697, 10080,
]);

export async function listenLocally(server: Server) {
  for (let tries = 0; tries < 100; tries++) {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const { port } = server.address() as AddressInfo;
    if (!refusedPorts.has(port)) return port;
    server.close();
    await once(server, 'close');
  }
  throw new Error('No local port that fetch accepts');
}

type Call = (
  path: string,
  init?: { method?: string; body?: unknown; headers?: Record<string, string> },
) => Promise<{ status: number; data: Record<string, unknown>; headers: Headers }>;

export async function withApi(
  pool: Pool,
  run: (call: Call) => Promise<void>,
  options: Parameters<typeof createApp>[1] = {},
) {
  const server = createServer(createApp(pool, options));
  const port = await listenLocally(server);
  try {
    await run(async (path, init = {}) => {
      const response = await fetch(`http://127.0.0.1:${port}${path}`, {
        method: init.method ?? 'GET',
        headers: {
          ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
          ...init.headers,
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
      // 204 No Content has no body.
      const text = await response.text();
      return {
        status: response.status,
        data: (text ? JSON.parse(text) : {}) as Record<string, unknown>,
        headers: response.headers,
      };
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}
