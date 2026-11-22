import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { useLoad } from './use-load';

test('an inline loader asks once per key, however often the component renders', async () => {
  const api = { get: vi.fn((key: string) => Promise.resolve(`data for ${key}`)) };
  const { result, rerender } = renderHook(({ id }) => useLoad(id, (key) => api.get(key)), {
    initialProps: { id: 'a' },
  });
  await waitFor(() => expect(result.current).toEqual({ state: 'ok', data: 'data for a' }));
  rerender({ id: 'a' });
  rerender({ id: 'a' });
  await act(async () => {});
  expect(api.get).toHaveBeenCalledTimes(1);

  rerender({ id: 'b' });
  expect(result.current).toEqual({ state: 'loading' });
  await waitFor(() => expect(result.current).toEqual({ state: 'ok', data: 'data for b' }));
  rerender({ id: 'b' });
  await act(async () => {});
  expect(api.get).toHaveBeenCalledTimes(2);
});

test('a new key uses the loader from the latest render', async () => {
  const { result, rerender } = renderHook(
    ({ id, tag }) => useLoad(id, (key) => Promise.resolve(`${tag}:${key}`)),
    { initialProps: { id: 'a', tag: 'old' } },
  );
  await waitFor(() => expect(result.current).toEqual({ state: 'ok', data: 'old:a' }));
  rerender({ id: 'b', tag: 'new' });
  await waitFor(() => expect(result.current).toEqual({ state: 'ok', data: 'new:b' }));
});
