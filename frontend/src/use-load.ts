import { useEffect, useState } from 'react';

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
