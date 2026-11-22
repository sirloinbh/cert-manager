// Named SQL parameters (#140). Write `:name` in the SQL and pass an object; the helper numbers the parameters in
// order of first use, so reordering the SQL or the object can never make a value fill another column.
// `::type` casts are left alone, and an unknown name throws instead of sending a wrong value.
export function named(
  sql: string,
  params: Record<string, unknown>,
): { text: string; values: unknown[] } {
  const index = new Map<string, number>();
  const values: unknown[] = [];
  const text = sql.replace(/(?<![:\w]):([A-Za-z]\w*)/g, (_match, name: string) => {
    if (!Object.hasOwn(params, name)) throw new Error(`Missing SQL parameter :${name}`);
    let position = index.get(name);
    if (position === undefined) {
      values.push(params[name]);
      position = values.length;
      index.set(name, position);
    }
    return `$${position}`;
  });
  return { text, values };
}
