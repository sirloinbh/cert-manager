import express, { type Express } from 'express';
import type { Pool } from 'pg';

import { exportTables, readExport, toCsv } from '../data-transfer.js';
import { importFile } from '../data-transfer-file.js';
import { mergeImport } from '../data-transfer-import.js';
import { withTransaction } from '../standard/db.js';
import { HttpError } from '../standard/http.js';
import { body } from '../validation.js';

// Backup of personal data (#210). The JSON file is the restore format; the CSV files are for reading in a spreadsheet.

const exportPath = '/api/data-transfer/export';
export const importPath = '/api/data-transfer/import';
// An export holds every record, so it is far bigger than the 256kb every other route accepts. The shared parser
// skips this path (app.ts) and this one reads it.
export const importLimit = '16mb';

export function registerDataTransferRoutes(app: Express, pool: Pool, today: () => string) {
  app.get(exportPath, async (_req, res) => {
    const client = await pool.connect();
    try {
      const file = await readExport(client, new Date());
      res.setHeader('Content-Disposition', `attachment; filename="cert-manager-${today()}.json"`);
      res.setHeader('Cache-Control', 'no-store');
      res.json(file);
    } finally {
      client.release();
    }
  });

  app.get(`${exportPath}/:table`, async (req, res) => {
    const table = exportTables.find((item) => item.name === req.params.table);
    if (!table) throw new HttpError(404, 'Table not found');
    const client = await pool.connect();
    try {
      const file = await readExport(client, new Date());
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="cert-manager-${table.name}-${today()}.csv"`,
      );
      res.setHeader('Cache-Control', 'no-store');
      res.send(toCsv(table, file.tables[table.name] ?? []));
    } finally {
      client.release();
    }
  });

  // Merge, keep existing (#211): validate the whole file first, then write everything in one transaction.
  app.post(importPath, express.json({ limit: importLimit }), async (req, res) => {
    const file = importFile.parse(body(req.body));
    const result = await withTransaction(pool, (client) => mergeImport(client, file));
    res.json({ result });
  });
}
