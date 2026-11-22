import { afterEach, vi } from 'vitest';

// A route-table stand-in for `fetch` (#157). A request that no route matches is an error: the fake answers it with a
// rejected promise (so the screen shows its failure) and the test fails after it ends, so a misspelled path or a
// request the screen was never meant to send cannot pass unnoticed.

export type FakeRequest = { method: string; path: string; body?: Record<string, unknown> };

type Handler = (request: FakeRequest, match: RegExpExecArray) => Response | Promise<Response>;

/** `[method, path, handler]`. A string path matches exactly; a RegExp must match the whole path. */
export type Route = readonly [method: string, path: string | RegExp, handler: Handler];

const unexpected: string[] = [];

afterEach(() => {
  const missed = takeUnexpected();
  if (missed.length > 0) throw new Error(`Unexpected requests:\n${missed.join('\n')}`);
});

/** The unmatched requests so far, cleared. For a test that sends one on purpose. */
export const takeUnexpected = () => unexpected.splice(0);

/** A JSON answer; no body for 204. */
export function reply(status: number, body?: object) {
  return Promise.resolve(
    new Response(body === undefined ? null : JSON.stringify(body), { status }),
  );
}

const matchPath = (route: string | RegExp, path: string) => {
  if (typeof route === 'string')
    return route === path ? ([path] as unknown as RegExpExecArray) : null;
  const found = route.exec(path);
  return found && found[0] === path ? found : null;
};

/** Replaces `fetch` with the first matching route. Returns every request sent, in order. */
export function fakeRoutes(routes: readonly Route[]) {
  const sent: FakeRequest[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string, init: { method?: string; body?: string } = {}) => {
      const method = init.method ?? 'GET';
      const body =
        init.body === undefined ? undefined : (JSON.parse(init.body) as Record<string, unknown>);
      const request: FakeRequest = { method, path, body };
      sent.push(request);
      for (const [routeMethod, routePath, handler] of routes) {
        if (routeMethod !== method) continue;
        const match = matchPath(routePath, path);
        if (match) return handler(request, match);
      }
      unexpected.push(`${method} ${path}`);
      return Promise.reject(new Error(`Unexpected request: ${method} ${path}`));
    }),
  );
  return { sent };
}

/** The dashboard's daily words card, with no words: for screen tests that render the overview but not this card. */
export function emptyDailyWords(today: string): Route[] {
  const day = { today, day: today, previousDay: null, nextDay: null, words: [], sources: [] };
  return [
    ['GET', '/api/daily-words', () => reply(200, day)],
    // The server picks the day's words on the first ask.
    ['POST', '/api/daily-words', () => reply(200, day)],
  ];
}
