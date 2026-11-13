# Certification manager PostgreSQL

PostgreSQL 17. The only source of migrations is `migrations/NNN_<description>.sql`. On an empty Docker volume, all files are applied automatically in name order on the first run, and CI also applies all files in order.

For an existing DB, apply a new migration directly as a file mounted in the container.

```powershell
docker compose exec -T db psql -U cert -d cert -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/NNN_<description>.sql
```

Do not pipe the file through PowerShell, as in `Get-Content … | docker compose exec … psql`. Windows PowerShell 5.1 sends ASCII to an external program, so Korean text turns into `?`.

Rules: write every migration so it is safe to run again. Reserve a number when you start a parallel branch. Keep the meaning of existing data, and leave values you could not confirm as NULL. For Korean literals in SQL, use the `U&'\XXXX'` escape where possible.
