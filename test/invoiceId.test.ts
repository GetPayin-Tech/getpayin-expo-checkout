import { describe, expect, it } from 'vitest';

import { invoiceIdFrom, normalizeInvoiceId } from '../src/core/invoiceId';

/** Past the point a JSON number keeps every digit of an invoice id. */
const MAX_SAFE = Number.MAX_SAFE_INTEGER;

describe('normalizeInvoiceId', () => {
  it.each([
    ['4512', '4512'],
    [' 4512 ', '4512'],
    ['004512', '4512'],
    ['0', '0'],
    ['000', '0'],
    [' INV-1 ', 'INV-1'],
    ['', ''],
  ])('reduces %s to %s', (value, expected) => {
    expect(normalizeInvoiceId(value)).toBe(expected);
  });

  /*
   * `+` decodes to a space, so this is what `invoice_id=+4512` arrives as. Before it was
   * trimmed, a paid checkout was reported as not paid and the payer was offered a retry.
   */
  it('reduces a value the query decoder left a space on', () => {
    expect(normalizeInvoiceId(' 4512')).toBe('4512');
  });
});

describe('invoiceIdFrom', () => {
  it.each([
    ['the number the server reported', 4512, '4512'],
    ['zero', 0, '0'],
    ['a negative id', -1, '-1'],
    ['the same id as text', '4512', '4512'],
    ['text with whitespace', '  4512  ', '4512'],
    ['an id that is not digits', 'INV-1', 'INV-1'],
  ])('reads %s as %s', (_label, value, expected) => {
    expect(invoiceIdFrom(value)).toBe(expected);
  });

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['an empty string', ''],
    ['a blank string', '   '],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['true', true],
    ['the whole init response', { invoice_id: 4512 }],
    ['an array', [4512]],
    ['a number that is not whole', 45.12],
    ['a number past Number.MAX_SAFE_INTEGER, whose digits are already lost', MAX_SAFE + 2],
    ['a number in exponent form, which never matches the link text', 1e21],
  ])('refuses %s', (_label, value) => {
    expect(invoiceIdFrom(value)).toBeUndefined();
  });
});
