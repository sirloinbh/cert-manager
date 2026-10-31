// The database a script writes to, named by DATABASE_URL.

// A password with an unescaped "/" or "#" breaks URL parsing and can end up in the error or the host,
// so a bad value stops here without being shown.
function targetName(url: string) {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL');
  }
  if (target.hash || target.pathname.includes('@')) {
    throw new Error('DATABASE_URL is not a valid URL');
  }
  return `${target.hostname}${target.pathname}`;
}

/** Says where the script will write, before it does anything slow. */
export function scriptDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  console.log(`Target database: ${targetName(url)}`);
  return url;
}
