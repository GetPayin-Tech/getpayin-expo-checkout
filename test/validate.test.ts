import { describe, expect, it } from 'vitest';

import { assertCheckoutUrl, assertExpectedInvoiceId, assertReturnUrl } from '../src/core/validate';
import { GetPayInConfigError } from '../src/errors';

/** Past the point a JSON number keeps every digit of an invoice id. */
const MAX_SAFE = Number.MAX_SAFE_INTEGER;

describe('assertCheckoutUrl', () => {
  it('accepts the https URL the server returned', () => {
    const url = 'https://pay.getpayin.com/checkout/abc?sig=1';

    expect(assertCheckoutUrl(url)).toBe(url);
  });

  it.each(['myapp://checkout', 'not a url', '', 'ftp://pay.getpayin.com'])(
    'refuses %s',
    (value) => {
      expect(() => assertCheckoutUrl(value)).toThrow(GetPayInConfigError);
    },
  );

  it("hands back the trimmed value it validated, not the caller's raw string", () => {
    expect(assertCheckoutUrl('  https://pay.getpayin.com/checkout/abc  ')).toBe(
      'https://pay.getpayin.com/checkout/abc',
    );
  });
});

describe('assertReturnUrl', () => {
  it('accepts an app scheme', () => {
    expect(assertReturnUrl('myapp://payment-return')).toBe('myapp://payment-return');
  });

  it.each(['payment-return', '', '://nope'])('refuses %s', (value) => {
    expect(() => assertReturnUrl(value)).toThrow(GetPayInConfigError);
  });

  it('hands back the trimmed value it validated', () => {
    expect(assertReturnUrl(' myapp://payment-return ')).toBe('myapp://payment-return');
  });
});

describe('assertExpectedInvoiceId', () => {
  it.each([
    ['the number the server reported', 4512, '4512'],
    ['the same id as text', '4512', '4512'],
    ['text with stray whitespace', ' 4512 ', '4512'],
    ['leading zeros, which carry no meaning', '004512', '4512'],
    ['an id that is not digits', 'INV-1', 'INV-1'],
  ])('accepts %s and hands back the text it is compared as', (_label, value, expected) => {
    expect(assertExpectedInvoiceId(value)).toBe(expected);
  });

  it('accepts no invoice id at all', () => {
    expect(assertExpectedInvoiceId(undefined)).toBeUndefined();
  });

  it.each([
    ['an empty string', ''],
    ['a blank string', '   '],
    ['null', null],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a number past Number.MAX_SAFE_INTEGER, which has already lost digits', MAX_SAFE + 2],
    ['a number in exponent form, which never matches the link text', 1e21],
    ['a number that is not a whole invoice id', 45.12],
    ['true', true],
    ['the whole init response', { invoice_id: 4512, checkout_url: 'https://x' }],
    ['an array', [4512]],
  ])('refuses %s with GetPayInConfigError', (_label, value) => {
    expect(() => assertExpectedInvoiceId(value)).toThrow(GetPayInConfigError);
  });

  it('names a bad object without serialising it, so a circular one cannot break the message', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => assertExpectedInvoiceId(circular)).toThrow(/a value of type object/);
  });

  it('shows a bad text value as written', () => {
    expect(() => assertExpectedInvoiceId('  ')).toThrow(/received " {2}"/);
  });
});
