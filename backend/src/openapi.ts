// OpenAPI 3.1 document built from the registered Express routes and the server's own Zod schemas.
// `npm run openapi -w backend` writes docs/openapi.json; a test fails when it is out of date.
import express from 'express';
import type { Pool } from 'pg';
import type { z } from 'zod/v4';

import { createApp } from './app.js';
import { certificationInput } from './routes/certifications.js';
import { learnedInput } from './routes/daily-words.js';
import { attemptInput } from './routes/exam-attempts.js';
import { lyricsInput, translationInput } from './routes/songs.js';
import {
  completionInput as taskCompletionInput,
  stageInput,
  taskInput,
} from './routes/study-plans.js';
import { actionInput, completionInput as actionCompletionInput } from './routes/user-actions.js';
import { dayQuery } from './validation.js';

type Json = Record<string, unknown>;

type CheckDef = {
  check: string;
  format?: string;
  pattern?: RegExp;
  minimum?: number;
  maximum?: number;
  length?: number;
  value?: number;
  inclusive?: boolean;
};
const checksOf = (def: Json) =>
  ((def.checks ?? []) as { _zod: { def: CheckDef } }[]).map((check) => check._zod.def);

const STRING_FORMATS: Record<string, string> = {
  uuid: 'uuid',
  guid: 'uuid',
  email: 'email',
  url: 'uri',
  datetime: 'date-time',
  date: 'date',
  time: 'time',
};
function stringFormat(format: string) {
  const name = STRING_FORMATS[format];
  if (!name) throw new Error(`Unsupported string format: ${format}`);
  return name;
}
// z.number().int() is a check and z.int() is the type itself; float32 and float64 are the same kinds but not integers.
const isIntegerFormat = (format: unknown) => typeof format === 'string' && format.includes('int');

// Converts the Zod 4 types the API uses. Refinements (cross-field rules) cannot be expressed
// here; any other unsupported type fails loudly instead of being silently dropped.
export function jsonSchema(schema: z.ZodType): Json {
  const def = schema._zod.def as unknown as Json & { type: string };
  switch (def.type) {
    case 'object': {
      const shape = def.shape as Record<string, z.ZodType>;
      const required = Object.keys(shape).filter((key) => !shape[key].isOptional());
      const catchall = def.catchall as z.ZodType | undefined;
      return {
        type: 'object',
        properties: Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, jsonSchema(v)])),
        ...(required.length ? { required } : {}),
        ...(catchall?._zod.def.type === 'never' ? { additionalProperties: false } : {}),
      };
    }
    case 'string': {
      const out: Json = { type: 'string' };
      // z.uuid() and z.email() carry their format on the type, z.string().uuid() as a check.
      if (def.format) out.format = stringFormat(def.format as string);
      for (const check of checksOf(def)) {
        if (check.check === 'min_length') out.minLength = check.minimum;
        else if (check.check === 'max_length') out.maxLength = check.maximum;
        else if (check.check === 'length_equals') out.minLength = out.maxLength = check.length;
        else if (check.check === 'string_format' && check.format === 'regex')
          out.pattern = check.pattern!.source;
        else if (check.check === 'string_format') out.format = stringFormat(check.format!);
        // `overwrite` is trim(); `custom` is a refinement.
        else if (check.check !== 'overwrite' && check.check !== 'custom')
          throw new Error(`Unsupported string check: ${check.format ?? check.check}`);
      }
      return out;
    }
    case 'number': {
      const out: Json = { type: isIntegerFormat(def.format) ? 'integer' : 'number' };
      for (const check of checksOf(def)) {
        if (check.check === 'number_format') {
          if (isIntegerFormat(check.format)) out.type = 'integer';
        } else if (check.check === 'greater_than')
          out[check.inclusive ? 'minimum' : 'exclusiveMinimum'] = check.value;
        else if (check.check === 'less_than')
          out[check.inclusive ? 'maximum' : 'exclusiveMaximum'] = check.value;
        else if (check.check === 'multiple_of') out.multipleOf = check.value;
        else if (check.check !== 'custom')
          throw new Error(`Unsupported number check: ${check.check}`);
      }
      return out;
    }
    case 'boolean':
      return { type: 'boolean' };
    case 'array': {
      let min: number | undefined;
      let max: number | undefined;
      for (const check of checksOf(def)) {
        if (check.check === 'min_length') min = check.minimum;
        else if (check.check === 'max_length') max = check.maximum;
        else if (check.check === 'length_equals') min = max = check.length;
        else if (check.check !== 'custom')
          throw new Error(`Unsupported array check: ${check.check}`);
      }
      return {
        type: 'array',
        items: jsonSchema(def.element as z.ZodType),
        ...(min !== undefined ? { minItems: min } : {}),
        ...(max !== undefined ? { maxItems: max } : {}),
      };
    }
    case 'enum':
      return { type: 'string', enum: Object.values(def.entries as Record<string, string>) };
    case 'nullable': {
      const inner = jsonSchema(def.innerType as z.ZodType);
      return typeof inner.type === 'string'
        ? { ...inner, type: [inner.type, 'null'] }
        : { anyOf: [inner, { type: 'null' }] };
    }
    case 'optional':
      return jsonSchema(def.innerType as z.ZodType);
    case 'default':
      return { ...jsonSchema(def.innerType as z.ZodType), default: def.defaultValue };
    // .transform() is a pipe; the request is described by what comes in. z.preprocess() is a pipe
    // starting from a transform, which says nothing about the value, so its target describes it.
    case 'pipe': {
      const input = def.in as z.ZodType;
      return jsonSchema(input._zod.def.type === 'transform' ? (def.out as z.ZodType) : input);
    }
    case 'unknown':
      return {};
    default:
      throw new Error(`Unsupported Zod type for OpenAPI: ${def.type}`);
  }
}

type Operation = {
  summary: string;
  body?: [name: string, schema: z.ZodType];
  query?: z.ZodType;
  // Success status first; the rest are documented error statuses.
  status: number[];
};
// Every registered route must appear here exactly once (checked when building).
// Every route that reads an id, a body or a query also answers 400 when validation fails.
const operations: Record<string, Operation> = {
  'GET /api/health': { summary: 'Check the server and database connection', status: [200, 500] },
  'GET /api/me': { summary: 'Get the signed-in user', status: [200, 401, 503] },

  'GET /api/grade-scales': { summary: 'List the grade scales a goal can use', status: [200] },
  'GET /api/certifications': {
    summary: 'List certification goals, grouped by category and nearest exam date first',
    status: [200],
  },
  'GET /api/certifications/:id': {
    summary: 'Get one certification goal',
    status: [200, 400, 404],
  },
  'POST /api/certifications': {
    summary: 'Add a certification goal; a validity type of months needs the validity months',
    body: ['Certification', certificationInput],
    status: [201, 400],
  },
  'PUT /api/certifications/:id': {
    summary: 'Replace a certification goal; the same cross-field rules as adding apply',
    body: ['Certification', certificationInput],
    status: [200, 400, 404],
  },
  'DELETE /api/certifications/:id': {
    summary: 'Delete a certification goal',
    status: [204, 400, 404],
  },

  'GET /api/exam-attempts/latest': {
    summary: 'Get the latest exam attempt of each goal, with its expiry',
    status: [200],
  },
  'GET /api/certifications/:id/attempts': {
    summary: 'List the exam attempts of a goal',
    status: [200, 400, 404],
  },
  'POST /api/certifications/:id/attempts': {
    summary:
      'Add an exam attempt; a pending outcome takes no score or grade, and a left-out expiry date asks for the goal default',
    body: ['ExamAttempt', attemptInput],
    status: [201, 400, 404],
  },
  'PUT /api/certifications/:id/attempts/:attemptId': {
    summary: 'Replace an exam attempt; the same cross-field rules as adding apply',
    body: ['ExamAttempt', attemptInput],
    status: [200, 400, 404],
  },
  'DELETE /api/certifications/:id/attempts/:attemptId': {
    summary: 'Delete an exam attempt',
    status: [204, 400, 404],
  },

  'GET /api/certifications/:id/plan': {
    summary: 'Get the study plan of a goal: its stages with their tasks',
    status: [200, 400, 404],
  },
  'GET /api/study-tasks/today': {
    summary: 'List the open study tasks due today or earlier',
    status: [200],
  },
  'POST /api/certifications/:id/stages': {
    summary: 'Add a study stage to a goal, last among its stages',
    body: ['StudyStage', stageInput],
    status: [201, 400, 404],
  },
  'PUT /api/study-stages/:id': {
    summary: 'Replace a study stage; the end date must not be before the start date',
    body: ['StudyStage', stageInput],
    status: [200, 400, 404],
  },
  'DELETE /api/study-stages/:id': {
    summary: 'Delete a study stage with its tasks',
    status: [204, 400, 404],
  },
  'POST /api/study-stages/:id/tasks': {
    summary: 'Add a task to a study stage',
    body: ['StudyTask', taskInput],
    status: [201, 400, 404],
  },
  'PUT /api/study-tasks/:id': {
    summary: 'Replace a study task',
    body: ['StudyTask', taskInput],
    status: [200, 400, 404],
  },
  'PATCH /api/study-tasks/:id/completion': {
    summary: 'Mark a study task completed or open again',
    body: ['StudyTaskCompletion', taskCompletionInput],
    status: [200, 400, 404],
  },
  'DELETE /api/study-tasks/:id': { summary: 'Delete a study task', status: [204, 400, 404] },

  'GET /api/user-actions': {
    summary: 'List the custom tasks shown as alerts',
    status: [200],
  },
  'POST /api/user-actions': {
    summary:
      'Add a custom task; the due date must not be before the reminder start date and a link must be http or https',
    body: ['UserAction', actionInput],
    status: [201, 400],
  },
  'PUT /api/user-actions/:id/completion': {
    summary: 'Mark a custom task completed or open again',
    body: ['UserActionCompletion', actionCompletionInput],
    status: [200, 400, 404],
  },
  'DELETE /api/user-actions/:id': { summary: 'Delete a custom task', status: [204, 400, 404] },

  'GET /api/songs': { summary: 'List songs with their translation status', status: [200] },
  'GET /api/songs/:id': { summary: 'Get one song with its lyric lines', status: [200, 400, 404] },
  'PUT /api/songs/:id/lyrics': {
    summary: 'Replace the original lyrics of a song; translations of unchanged lines are kept',
    body: ['SongLyrics', lyricsInput],
    status: [200, 400, 404],
  },
  'PUT /api/songs/:id/translation': {
    summary:
      'Save the translation of a song; its non-blank line count must equal the original lyric lines',
    body: ['SongTranslation', translationInput],
    status: [200, 400, 404],
  },

  'GET /api/words': { summary: 'List words', status: [200] },
  'GET /api/words/:id': { summary: 'Get one word', status: [200, 400, 404] },
  'GET /api/daily-words': {
    summary:
      'Get the words of a day (today by default), choosing them the first time today is opened',
    query: dayQuery,
    status: [200, 400],
  },
  'PUT /api/words/:id/learned': {
    summary: 'Mark a word learned or not learned',
    body: ['WordLearned', learnedInput],
    status: [200, 400, 404],
  },
};

type Layer = {
  route?: { path: string; methods: Record<string, boolean> };
  handle?: { stack?: Layer[] };
};

// The routes live in sub-routers mounted with app.use(prefix, router). Express keeps no mount path
// on the layer, so it is recorded while the app is built (see documentedApp).
const mounts = new WeakMap<object, string>();

// The app as the server builds it, with no database: routes are only registered, never called, so
// the pool is never used. Use this instead of createApp where the routes are listed.
export function documentedApp() {
  const original = express.application.use;
  express.application.use = function (this: unknown, ...args: unknown[]) {
    const [first, ...handlers] = args;
    if (typeof first === 'string')
      for (const handler of handlers.flat())
        if (typeof handler === 'function') mounts.set(handler, first);
    return (original as (...all: unknown[]) => unknown).apply(this, args);
  } as typeof original;
  try {
    return createApp({} as Pool);
  } finally {
    express.application.use = original;
  }
}

function routesOf(stack: Layer[], prefix: string): string[] {
  return stack.flatMap((layer) => {
    if (layer.route) {
      const path = layer.route.path === '/' ? '' : layer.route.path;
      return Object.keys(layer.route.methods).map((m) => `${m.toUpperCase()} ${prefix}${path}`);
    }
    const mount = layer.handle && mounts.get(layer.handle);
    return layer.handle?.stack && mount !== undefined
      ? routesOf(layer.handle.stack, prefix + mount)
      : [];
  });
}
export function registeredRoutes(app: express.Express) {
  return routesOf((app as unknown as { router: { stack: Layer[] } }).router.stack, '');
}

const statusText: Record<number, string> = {
  200: 'Success',
  201: 'Created',
  204: 'Success, no content',
  400: 'Input validation failed',
  401: 'Sign-in required (no session from the shared sign-in)',
  404: 'No target',
  500: 'Server error',
  503: 'The shared sign-in is unavailable or not configured',
};

// Path parameters are all plain integer ids (id, attemptId).
const idParam = { type: 'integer', minimum: 1, maximum: 999_999_999_999_999 };

export function buildOpenApi(app: express.Express) {
  const routes = registeredRoutes(app);
  const missing = routes.filter((route) => !operations[route]);
  const extra = Object.keys(operations).filter((route) => !routes.includes(route));
  if (missing.length || extra.length)
    throw new Error(`OpenAPI operations differ from routes: +${missing} -${extra}`);
  const schemas: Json = {
    Error: {
      type: 'object',
      properties: { error: { type: 'string', description: 'English error message' } },
      required: ['error'],
    },
  };
  const paths: Record<string, Json> = {};
  for (const route of [...routes].sort()) {
    const [method, path] = route.split(' ');
    const op = operations[route];
    const parameters: Json[] = [...path.matchAll(/:(\w+)/g)].map(([, name]) => ({
      name,
      in: 'path',
      required: true,
      schema: idParam,
    }));
    if (op.query) {
      const query = jsonSchema(op.query) as { properties: Json; required?: string[] };
      for (const [name, schema] of Object.entries(query.properties))
        parameters.push({ name, in: 'query', required: !!query.required?.includes(name), schema });
    }
    if (op.body) schemas[op.body[0]] = jsonSchema(op.body[1]);
    const [success, ...failures] = op.status;
    const responses: Json = { [success]: { description: statusText[success] } };
    for (const status of failures)
      responses[status] = {
        description: statusText[status],
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      };
    const key = path.replace(/:(\w+)/g, '{$1}');
    paths[key] ??= {};
    paths[key][method.toLowerCase()] = {
      summary: op.summary,
      ...(parameters.length ? { parameters } : {}),
      ...(op.body
        ? {
            requestBody: {
              required: true,
              content: {
                'application/json': { schema: { $ref: `#/components/schemas/${op.body[0]}` } },
              },
            },
          }
        : {}),
      responses,
    };
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'Cert Manager API',
      version: '1.0.0',
      description:
        'Dates are YYYY-MM-DD (Asia/Seoul). Every route can also answer 429 when the API rate limit is exceeded. Every error response is { error: English message }.',
    },
    servers: [{ url: '/' }],
    paths,
    components: { schemas },
  };
}
