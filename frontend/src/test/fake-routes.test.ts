import { expect, test } from 'vitest';

import { fakeRoutes, reply, takeUnexpected } from './fake-routes';

test('a matching route answers and an unmatched request is rejected', async () => {
  const { sent } = fakeRoutes([
    ['GET', '/api/things', () => reply(200, { things: [] })],
    ['PUT', /\/api\/things\/(\d+)/, (_request, match) => reply(200, { id: Number(match[1]) })],
  ]);
  expect(await (await fetch('/api/things')).json()).toEqual({ things: [] });
  expect(await (await fetch('/api/things/7', { method: 'PUT', body: '{}' })).json()).toEqual({
    id: 7,
  });
  // The wrong method and a longer path do not match either route.
  await expect(fetch('/api/things', { method: 'POST' })).rejects.toThrow('Unexpected request');
  await expect(fetch('/api/things/7/x', { method: 'PUT' })).rejects.toThrow('Unexpected request');
  expect(takeUnexpected()).toEqual(['POST /api/things', 'PUT /api/things/7/x']);
  expect(sent.map((item) => `${item.method} ${item.path}`)).toEqual([
    'GET /api/things',
    'PUT /api/things/7',
    'POST /api/things',
    'PUT /api/things/7/x',
  ]);
});
