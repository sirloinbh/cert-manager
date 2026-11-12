// One request at a time to a free public service, the way its rules ask (#64, #36).

const userAgent = 'cert-manager/0.1 (https://github.com/sirloinbh/cert-manager)';
const maxAttempts = 3;
// A busy LRCLIB search answers 503 with "Retry-After: 1" about half the time (#89),
// so a 503 gets more tries, each waiting longer than the last.
const busyAttempts = 5;
const busyFirstWaitSeconds = 5;
const requestTimeout = 30_000;
// When a 429 does not say how long to wait. A 503 without it waits the backoff.
const defaultRetrySeconds = 60;
// Asked to wait longer than this, the script stops and can be run again later.
const longestWaitSeconds = 300;
/** This many items failing in a row means the service or the network is down. */
export const mostFailuresInARow = 5;

/** An answer whose text is safe to print. Parse errors can quote the response, so they are not printed. */
export class ServiceError extends Error {}
/** The service wants us to stop. Asking about the next item would only make that worse. */
export class RateLimited extends ServiceError {}

export type PoliteSource = {
  baseUrl: string;
  sleep: (ms: number) => Promise<void>;
};

/** One request, then the gap. Null for a 404. Waits and tries again when asked to, within reason. */
export async function politeGet(
  url: string,
  options: { name: string; gap: number; sleep: PoliteSource['sleep']; accept?: string },
) {
  // Counted apart, so a mix of 429s and 503s still ends (#89 review).
  let limitedTries = 0;
  let busyTries = 0;
  for (;;) {
    const response = await fetch(url, {
      headers: { 'User-Agent': userAgent, ...(options.accept ? { Accept: options.accept } : {}) },
      signal: AbortSignal.timeout(requestTimeout),
    });
    await options.sleep(options.gap);
    if (response.status === 404) return null;
    if (response.ok) return response;
    if (response.status !== 429 && response.status !== 503) {
      throw new ServiceError(`${options.name} ${response.status}`);
    }
    const asked = Number(response.headers.get('retry-after'));
    if (response.status === 429) {
      limitedTries += 1;
      const seconds = asked > 0 ? asked : defaultRetrySeconds;
      if (seconds > longestWaitSeconds || limitedTries >= maxAttempts) {
        throw new RateLimited(`${options.name} 429, asked to wait ${seconds} seconds`);
      }
      await options.sleep(seconds * 1000);
      continue;
    }
    // A 503 is a busy server, not a limit: wait what it asks or longer, never past longestWaitSeconds.
    if (asked > longestWaitSeconds) {
      throw new RateLimited(`${options.name} 503, asked to wait ${asked} seconds`);
    }
    busyTries += 1;
    // Still busy after every try: that item fails, and the caller moves on to the next one.
    if (busyTries >= busyAttempts) {
      throw new ServiceError(`${options.name} 503, ${busyAttempts} attempts`);
    }
    const backoff = busyFirstWaitSeconds * 2 ** (busyTries - 1);
    await options.sleep(Math.max(asked > 0 ? asked : 0, backoff) * 1000);
  }
}
