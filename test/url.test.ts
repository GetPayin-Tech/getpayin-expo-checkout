import { describe, expect, it } from 'vitest';

import { isSameTarget, normalizeToken, parseQuery, parseUrl } from '../src/core/url';

describe('parseUrl', () => {
  it('splits a custom app scheme', () => {
    expect(parseUrl('myapp://payment-return?status=paid')).toEqual({
      scheme: 'myapp',
      authority: 'payment-return',
      path: '',
      query: 'status=paid',
    });
  });

  it('splits an https URL with a path', () => {
    expect(parseUrl('https://pay.getpayin.com/checkout/abc?x=1#frag')).toEqual({
      scheme: 'https',
      authority: 'pay.getpayin.com',
      path: '/checkout/abc',
      query: 'x=1',
    });
  });

  it('handles a scheme with no authority', () => {
    expect(parseUrl('mailto:support@example.com')).toEqual({
      scheme: 'mailto',
      authority: '',
      path: '/support@example.com',
      query: '',
    });
  });

  it('lowercases the scheme and host but keeps the path case', () => {
    expect(parseUrl('HTTPS://Pay.GetPayIn.com/Checkout')).toMatchObject({
      scheme: 'https',
      authority: 'pay.getpayin.com',
      path: '/Checkout',
    });
  });

  it('rejects a value with no scheme', () => {
    expect(parseUrl('payment-return?status=paid')).toBeUndefined();
  });

  it('rejects an empty value', () => {
    expect(parseUrl('   ')).toBeUndefined();
  });
});

describe('isSameTarget', () => {
  it('treats a missing and a present trailing slash as one target', () => {
    expect(isSameTarget('myapp://return/', 'myapp://return')).toBe(true);
  });

  it('separates two hosts', () => {
    expect(isSameTarget('myapp://a', 'myapp://b')).toBe(false);
  });

  it('is false when either side is unparseable', () => {
    expect(isSameTarget('nonsense', 'myapp://return')).toBe(false);
    expect(isSameTarget('myapp://return', 'nonsense')).toBe(false);
  });
});

describe('parseQuery', () => {
  it('normalises keys across naming styles', () => {
    expect(parseQuery('Invoice_Id=1&paid-status=paid')).toEqual({
      invoiceid: '1',
      paidstatus: 'paid',
    });
  });

  it('keeps a parameter with no value', () => {
    expect(parseQuery('flag')).toEqual({ flag: '' });
  });

  it('keeps an equals sign inside a value', () => {
    expect(parseQuery('token=a=b')).toEqual({ token: 'a=b' });
  });

  it('skips empty pairs and blank keys', () => {
    expect(parseQuery('&&=value&a=1')).toEqual({ a: '1' });
  });

  it('returns nothing for an empty query', () => {
    expect(parseQuery('')).toEqual({});
  });
});

describe('normalizeToken', () => {
  it('strips case, spacing and separators', () => {
    expect(normalizeToken('  Not_Paid ')).toBe('notpaid');
    expect(normalizeToken('user-cancelled')).toBe('usercancelled');
  });
});
