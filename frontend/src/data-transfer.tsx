import { Download } from 'lucide-react';

import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { exportCsvPath, exportJsonPath, exportTables } from './data-transfer-data';

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
