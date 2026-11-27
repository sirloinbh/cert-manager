import { Download, Upload } from 'lucide-react';
import { type ChangeEvent, useRef, useState } from 'react';

import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { ConfirmDialog } from './components/ui/confirm-dialog';
import { Notice } from './components/ui/notice';
import {
  exportCsvPath,
  exportJsonPath,
  exportTables,
  importApi,
  importSummary,
  rowCount,
} from './data-transfer-data';
import { useNotice } from './lib/use-notice';

// The backup card on the Settings page (#210). Each button is a link to the API: the server answers with a
// download header, so the browser saves the file and the signed-in session cookie goes along.
export function DataExport() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Export data</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-body-sm text-muted-foreground">
          Save your certifications, exam attempts, study plans and custom tasks. Words, daily words
          and songs are not included.
        </p>
        <div className="flex flex-col gap-2">
          <Button asChild className="self-start">
            <a href={exportJsonPath} download>
              <Download aria-hidden="true" />
              Export data (JSON)
            </a>
          </Button>
          <p className="text-caption text-muted-foreground">
            The JSON file is the backup. It can be restored later.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-body font-medium">Spreadsheet files (CSV)</h3>
          <ul className="flex flex-wrap gap-2">
            {exportTables.map((table) => (
              <li key={table.name}>
                <Button asChild variant="outline" size="sm">
                  <a href={exportCsvPath(table.name)} download>
                    {table.label} (CSV)
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

// The restore card on the Settings page (#211). A file is read here and checked for JSON, the confirmation says
// what will change, and only then is it sent. The server checks the whole file again and a bad file changes nothing.
export function DataImport() {
  const input = useRef<HTMLInputElement>(null);
  const { notice, status, error, clear } = useNotice();
  const [chosen, setChosen] = useState<{ name: string; file: unknown; rows: number } | undefined>(
    undefined,
  );

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    // Choosing the same file again must fire a change, so the input is emptied after reading.
    event.target.value = '';
    if (!picked) return;
    clear();
    try {
      const file: unknown = JSON.parse(await picked.text());
      setChosen({ name: picked.name, file, rows: rowCount(file) });
    } catch {
      error('This is not a JSON file. Choose a file saved with "Export data (JSON)".');
    }
  };

  const restore = async () => {
    if (!chosen) return;
    try {
      const { result } = await importApi.merge(chosen.file);
      status(importSummary(result));
      setChosen(undefined);
    } catch (cause) {
      error(cause, 'Could not import the file');
      setChosen(undefined);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import data</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-body-sm text-muted-foreground">
          Add the data of an exported JSON file. Rows that already exist are skipped and nothing is
          changed or deleted. If the file has an error, nothing is saved.
        </p>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-label="Export file"
          onChange={(event) => void choose(event)}
        />
        <Button variant="outline" className="self-start" onClick={() => input.current?.click()}>
          <Upload aria-hidden="true" />
          Choose a file to import
        </Button>
        <Notice notice={notice} />
        <ConfirmDialog
          open={chosen !== undefined}
          onOpenChange={(open) => !open && setChosen(undefined)}
          destructive={false}
          title="Import this file?"
          description={
            <span className="wrap-anywhere">
              {`'${chosen?.name ?? ''}' has ${chosen?.rows ?? 0} ${chosen?.rows === 1 ? 'row' : 'rows'}. Rows that are not in the app yet are added; rows that already exist are skipped. Nothing is changed or deleted.`}
            </span>
          }
          confirmLabel="Import"
          returnFocusRef={input}
          onConfirm={restore}
        />
      </CardContent>
    </Card>
  );
}
