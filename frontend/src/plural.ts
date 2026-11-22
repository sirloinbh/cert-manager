/** "1 day", "2 days": the count with its noun in the right form. `plural` is only needed for irregular nouns. */
export function quantity(n: number, singular: string, plural = `${singular}s`) {
  return `${n} ${n === 1 ? singular : plural}`;
}
