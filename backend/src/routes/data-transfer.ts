import type { Express } from 'express';
import type { Pool } from 'pg';

import { exportTables, readExport, toCsv } from '../data-transfer.js';
import { HttpError } from '../standard/http.js';

// Backup of personal data (#210). The JSON file is the restore format; the CSV files are for reading in a spreadsheet.

const exportPath = '/api/data-transfer/export';

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
}
