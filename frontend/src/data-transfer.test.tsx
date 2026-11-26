import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { DataExport } from './data-transfer';

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

test('it says that words and songs are not included', () => {
  render(<DataExport />);
  expect(screen.getByText(/Words, daily words and songs are not included/)).toBeTruthy();
});
