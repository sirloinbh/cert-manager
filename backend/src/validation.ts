import { z } from 'zod';

// Input rules shared by the feature routes. Messages are shown to the user, so they stay Korean.

// A real calendar day as YYYY-MM-DD: 2026-02-30 is rejected, not rolled over to March.
// Year 0 passes the Date round trip but PostgreSQL rejects it, so the range starts at 1900.
export const calendarDate = (label: string) =>
  z
    .string({ message: `${label}은 YYYY-MM-DD 형식이어야 합니다` })
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label}은 YYYY-MM-DD 형식이어야 합니다`)
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }, `${label}이 실제 날짜가 아닙니다`)
    .refine((value) => value >= '1900-01-01', `${label}은 1900-01-01 이후여야 합니다`);

export const shortText = (label: string) =>
  z
    .string({ message: `${label}은 문자열이어야 합니다` })
    .trim()
    .max(200, `${label}은 200자 이하로 입력해 주세요`);

// Express leaves req.body undefined without a JSON body; parse {} so field messages stay Korean.
export const body = (value: unknown) => value ?? {};

// pg returns bigint as a string; ids stay within 15 digits, so they are exact as numbers.
export function toId(value: string) {
  const id = Number(value);
  if (!Number.isSafeInteger(id)) throw new Error(`id out of range: ${value}`);
  return id;
}
