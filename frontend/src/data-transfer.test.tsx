import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { DataExport, DataImport } from './data-transfer';
import { fakeRoutes, reply } from './test/fake-routes';

test('the export button points at the export endpoint and downloads the file', () => {
  render(<DataExport />);
  const button = screen.getByRole('link', { name: 'Export data (JSON)' });
  expect(button.getAttribute('href')).toBe('/api/data-transfer/export');
  expect(button.hasAttribute('download')).toBe(true);
});

test('there is one CSV link for each included table', () => {
  render(<DataExport />);
  const links = screen.getAllByRole('link', { name: /\(CSV\)$/ });
  expect(links.map((link) => link.getAttribute('href'))).toEqual([
    '/api/data-transfer/export/certifications',
    '/api/data-transfer/export/examAttempts',
    '/api/data-transfer/export/studyStages',
    '/api/data-transfer/export/studyTasks',
    '/api/data-transfer/export/userActions',
  ]);
});

describe('import', () => {
  const backup = {
    version: 1,
    tables: { certifications: [{ id: 1 }, { id: 2 }], examAttempts: [], userActions: [{ id: 1 }] },
  };
  const result = {
    certifications: { added: 1, skipped: 1 },
    examAttempts: { added: 0, skipped: 0 },
    studyStages: { added: 0, skipped: 0 },
    studyTasks: { added: 0, skipped: 0 },
    userActions: { added: 1, skipped: 0 },
  };

  const pick = (content: string, name = 'backup.json') => {
    const input = screen.getByLabelText('Export file');
    // jsdom's File has no text(), so the one the component calls is supplied.
    const file = new File([content], name, { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: () => Promise.resolve(content) });
    fireEvent.change(input, { target: { files: [file] } });
  };

  test('asks before it sends anything and says what will change', async () => {
    const { sent } = fakeRoutes([
      ['POST', '/api/data-transfer/import', () => reply(200, { result })],
    ]);
    render(<DataImport />);
    pick(JSON.stringify(backup));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/'backup.json' has 3 rows/)).toBeTruthy();
    expect(within(dialog).getByText(/skipped/)).toBeTruthy();
    // Nothing has been sent while the question is open.
    expect(sent).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Import' }));
    expect(await screen.findByText('Added 2 rows, skipped 1 that already existed.')).toBeTruthy();
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toEqual(backup);
  });

  test('cancelling sends nothing', async () => {
    const { sent } = fakeRoutes([]);
    render(<DataImport />);
    pick(JSON.stringify(backup));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(sent).toHaveLength(0);
  });

  test('a file that is not JSON is refused before any question or request', async () => {
    const { sent } = fakeRoutes([]);
    render(<DataImport />);
    pick('not json');
    expect(await screen.findByText(/This is not a JSON file/)).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(sent).toHaveLength(0);
  });

  test("the server's reason is shown when it refuses the file", async () => {
    fakeRoutes([
      [
        'POST',
        '/api/data-transfer/import',
        () =>
          reply(400, { error: 'This file has an unsupported version; this app reads version 1' }),
      ],
    ]);
    render(<DataImport />);
    pick(JSON.stringify({ version: 9, tables: {} }));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Import' }),
    );
    expect(await screen.findByText(/unsupported version/)).toBeTruthy();
  });
});
