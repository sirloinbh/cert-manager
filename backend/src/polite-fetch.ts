// One request at a time to a free public service, the way its rules ask (#64, #36).

const userAgent = 'cert-manager/0.1 (https://github.com/sirloinbh/cert-manager)';
const maxAttempts = 3;
// A busy LRCLIB search answers 503 with "Retry-After: 1" about half the time (#89),
// so a 503 gets more tries, each waiting longer than the last.
const busyAttempts = 5;
const busyFirstWaitSeconds = 5;
const requestTimeout = 30_000;
// When a 429 or 503 does not say how long to wait.
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
  for (let attempt = 1; ; attempt += 1) {
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
    const busy = response.status === 503;
    const asked = Number(response.headers.get('retry-after'));
    const seconds = asked > 0 ? asked : defaultRetrySeconds;
    if (seconds > longestWaitSeconds || (!busy && attempt === maxAttempts)) {
      throw new RateLimited(`${options.name} ${response.status}, 대기 ${seconds}초 요청`);
    }
    // Still busy after every try: that item fails, and the caller moves on to the next one.
    if (busy && attempt === busyAttempts) {
      throw new ServiceError(`${options.name} 503, ${busyAttempts}번 시도`);
    }
    const wait = busy ? Math.max(seconds, busyFirstWaitSeconds * 2 ** (attempt - 1)) : seconds;
    await options.sleep(wait * 1000);
  }
}
