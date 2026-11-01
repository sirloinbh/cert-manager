import express from 'express';
import type { Pool } from 'pg';
import { types } from 'pg';

import { apiRateLimit, type RateLimitOptions } from './rate-limit.js';
import { registerCertificationRoutes } from './routes/certifications.js';
import { registerDailyWordRoutes } from './routes/daily-words.js';
import { registerExamAttemptRoutes } from './routes/exam-attempts.js';
import { registerSongRoutes } from './routes/songs.js';
import { registerStudyPlanRoutes } from './routes/study-plans.js';
import { registerUserActionRoutes } from './routes/user-actions.js';
import { registerWordRoutes } from './routes/words.js';
import { errorHandler, notFound, serviceDate } from './standard/http.js';

// DATE columns stay YYYY-MM-DD strings so the service time zone never shifts them.
types.setTypeParser(1082, (value) => value);

export function createApp(
  pool: Pool,
  options: { today?: () => string; rateLimit?: RateLimitOptions } = {},
) {
  const today = options.today ?? (() => serviceDate());
  const app = express();
  app.disable('x-powered-by');
  // Before the body parser and every route, so a refused request costs neither parsing nor a query.
  app.use(apiRateLimit(options.rateLimit));
  app.use(express.json({ limit: '256kb' }));
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
  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}
