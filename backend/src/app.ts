import { meHandler } from '@sirloinbh/auth-client';
import express from 'express';
import type { Pool } from 'pg';
import { types } from 'pg';

import { tools } from './ai-tools.js';
import { registerCertificationRoutes } from './routes/certifications.js';
import { registerDailyWordRoutes } from './routes/daily-words.js';
import { registerExamAttemptRoutes } from './routes/exam-attempts.js';
import { registerSongRoutes } from './routes/songs.js';
import { registerStudyPlanRoutes } from './routes/study-plans.js';
import { registerUserActionRoutes } from './routes/user-actions.js';
import { registerWordRoutes } from './routes/words.js';
import { setInt8Parser } from './standard/db.js';
import { errorHandler, notFound, requestLog, serviceDate } from './standard/http.js';
import { apiRateLimit } from './standard/rate-limit.js';
import { registerToolRoutes } from './standard/tools.js';

// DATE columns stay YYYY-MM-DD strings so the service time zone never shifts them.
types.setTypeParser(1082, (value) => value);
setInt8Parser(types);

export function createApp(
  pool: Pool,
  options: {
    today?: () => string;
    requestsPerMinute?: number;
    auth?: express.RequestHandler;
    // shared-ai's public key (project-standards#711). None by default: /internal/tools is then a JSON 404.
    toolsPublicKey?: string;
  } = {},
) {
  const today = options.today ?? (() => serviceDate());
  const app = express();
  app.disable('x-powered-by');
  // project-standards#552: a request ID and one JSON log line for every request, a refused one included.
  app.use(requestLog);
  // Before the body parser and every route, so a refused request costs neither parsing nor a query.
  apiRateLimit(app, { limitPerMinute: options.requestsPerMinute });
  app.use(express.json({ limit: '256kb' }));
  // #116: the shared sign-in guards every /api route except /api/health, before any route registers.
  if (options.auth) app.use('/api', options.auth);
  app.get('/api/me', meHandler);
  app.get('/api/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ ok: true, service: 'cert-manager', today: today() });
  });
  registerCertificationRoutes(app, pool, today);
  registerExamAttemptRoutes(app, pool, today);
  registerStudyPlanRoutes(app, pool, today);
  registerUserActionRoutes(app, pool, today);
  registerSongRoutes(app, pool);
  registerWordRoutes(app, pool);
  registerDailyWordRoutes(app, pool, today);
  // AI tools for shared-ai on /internal/tools: outside /api, so nginx never forwards them and the signed call
  // token, not the session, is the check. shared-ai signs the tool and jti claims, so the app requires them.
  registerToolRoutes(app, {
    app: 'cert-manager',
    tools,
    pool,
    publicKey: options.toolsPublicKey,
    requireBinding: true,
  });
  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}
