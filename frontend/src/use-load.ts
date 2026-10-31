import { useCallback, useEffect, useState } from 'react';

export type Loaded<T> =
  { state: 'loading' } | { state: 'ok'; data: T } | { state: 'error'; error: unknown };

// Loads once per key. The result remembers its key, so a new key shows loading without resetting state in the effect.
export function useLoad<T>(key: string, load: (key: string) => Promise<T>): Loaded<T> {
  const [result, setResult] = useState<{ key: string; value: Loaded<T> }>();
  useEffect(() => {
    let active = true;
    load(key).then(
      (data) => active && setResult({ key, value: { state: 'ok', data } }),
      (error: unknown) => active && setResult({ key, value: { state: 'error', error } }),
    );
    return () => {
      active = false;
    };
  }, [key, load]);
  return result?.key === key ? result.value : { state: 'loading' };
}

/**
 * useLoad for data that changes on the page. `data` stays on screen while `reload` runs and when it fails.
 * `reload(change)` also applies the change right away, so a failed reload cannot bring back a deleted row.
 */
export function useReloading<T>(id: string, load: (id: string) => Promise<T>) {
  const [version, setVersion] = useState(0);
  const loadKey = useCallback((key: string) => load(key.slice(0, key.lastIndexOf('/'))), [load]);
  const loaded = useLoad(`${id}/${version}`, loadKey);
  const [shown, setShown] = useState<T>();
  if (loaded.state === 'ok' && loaded.data !== shown) setShown(loaded.data);
  const reload = useCallback((change?: (current: T) => T) => {
    if (change) setShown((current) => (current === undefined ? current : change(current)));
    setVersion((current) => current + 1);
  }, []);
  return { loaded, data: loaded.state === 'ok' ? loaded.data : shown, reload };
}
