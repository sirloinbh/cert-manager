import { rateLimit } from 'express-rate-limit';

import type { ApiError } from './standard/http.js';

// Request limit inside the API (#49). frontend/nginx.conf limits first at 10 requests a second with bursts of 40;
// this looser limit is the second line, so normal use through nginx never reaches it.

export type RateLimitOptions = { limit?: number; windowMs?: number };

export function apiRateLimit({ limit = 1200, windowMs = 60_000 }: RateLimitOptions = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요' } satisfies ApiError,
    // nginx passes a client's X-Forwarded-For through, but the API does not trust proxies:
    // every request counts against the address it came from, so the check would only log noise.
    validate: { xForwardedForHeader: false },
  });
}
