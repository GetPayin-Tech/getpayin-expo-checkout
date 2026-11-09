import { describe, expect, it } from 'vitest';

import { assertCheckoutUrl, assertReturnUrl } from '../src/core/validate';
import { GetPayInConfigError } from '../src/errors';

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
