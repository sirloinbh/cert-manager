import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';

import { listenLocally } from './helpers.js';

test('a test server listens again when it is given a port that fetch refuses', async (t) => {
  const server = createServer((_req, res) => res.end('ok'));
  t.after(() => server.close());
  const real = server.address.bind(server);
  const given = [6000, 6666];
  server.address = () => {
    const port = given.shift();
    return port ? { ...(real() as AddressInfo), port } : real();
  };

  const port = await listenLocally(server);

  assert.deepEqual(given, []);
  assert.equal(port, (real() as AddressInfo).port);
  const response = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(await response.text(), 'ok');
});

test('fetch still refuses the ports the test server stays away from', async () => {
  await assert.rejects(
    fetch('http://127.0.0.1:6000/'),
    (error: TypeError) => (error.cause as Error).message === 'bad port',
  );
});
