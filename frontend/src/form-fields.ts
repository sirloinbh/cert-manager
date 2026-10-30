// Shared by the goal and attempt forms.

export const controlClass =
  'flex w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none pointer-coarse:min-h-11 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-body-sm dark:bg-input/30';

// Empty number fields are "not decided" (null). Text that is not a number goes as it is so the server explains.
export function toNumber(value: string) {
  const text = value.trim();
  if (text === '') return null;
  const number = Number(text);
  return Number.isNaN(number) ? text : number;
}
