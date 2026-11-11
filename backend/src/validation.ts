import { z } from 'zod/v4';

// Input rules shared by the feature routes. Messages are shown to the user, so they are written in English.
// Text length is checked with refine: zod 4 runs .min and .max on any value with a length, even after the
// type check failed, so an array sent as text would also answer the length message.

// A real calendar day as YYYY-MM-DD: 2026-02-30 is rejected, not rolled over to March.
// Year 0 passes the Date round trip but PostgreSQL rejects it, so the range starts at 1900.
export const calendarDate = (label: string) =>
  z
    .string({ error: `${label} must be in YYYY-MM-DD format` })
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be in YYYY-MM-DD format`)
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }, `${label} is not a real date`)
    .refine((value) => value >= '1900-01-01', `${label} must be on or after 1900-01-01`);

export const shortText = (label: string) =>
  z
    .string({ error: `${label} must be text` })
    .trim()
    .refine((value) => value.length <= 200, `${label} must be 200 characters or fewer`);

// ?day=YYYY-MM-DD, optional.
export const dayQuery = z.object({ day: calendarDate('Date').optional() });

// Express leaves req.body undefined without a JSON body; parse {} so field messages stay English.
export const body = (value: unknown) => value ?? {};

// pg returns bigint as a string; ids stay within 15 digits, so they are exact as numbers.
export function toId(value: string) {
  const id = Number(value);
  if (!Number.isSafeInteger(id)) throw new Error(`id out of range: ${value}`);
  return id;
}
