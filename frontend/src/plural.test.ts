import { expect, test } from 'vitest';

import { quantity } from './plural';

test('a count takes the singular only for exactly one', () => {
  expect(quantity(0, 'day')).toBe('0 days');
  expect(quantity(1, 'day')).toBe('1 day');
  expect(quantity(2, 'day')).toBe('2 days');
  expect(quantity(1, 'manual task')).toBe('1 manual task');
  expect(quantity(3, 'child', 'children')).toBe('3 children');
});
