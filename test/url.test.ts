import { describe, expect, it } from 'vitest';

import { isSameTarget, normalizeToken, parseUrl, readQuery } from '../src/core/url';

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

describe('readQuery', () => {
  it('keeps names exactly as sent', () => {
    expect([...readQuery('Invoice_Id=1&invoice_id=2&success=1')]).toEqual([
      ['Invoice_Id', ['1']],
      ['invoice_id', ['2']],
      ['success', ['1']],
    ]);
  });

  it('keeps every value of a repeated name, in order', () => {
    expect(readQuery('success=1&success=0').get('success')).toEqual(['1', '0']);
  });

  it('decodes names and values, with a plus as a space', () => {
    expect(readQuery('invoice%5Fid=7&message=Card+declined%21').get('invoice_id')).toEqual(['7']);
    expect(readQuery('message=Card+declined%21').get('message')).toEqual(['Card declined!']);
  });

  it('keeps a parameter with no value', () => {
    expect(readQuery('flag').get('flag')).toEqual(['']);
  });

  it('keeps an equals sign inside a value', () => {
    expect(readQuery('token=a=b').get('token')).toEqual(['a=b']);
  });

  it('skips empty pairs', () => {
    expect([...readQuery('&&a=1')]).toEqual([['a', ['1']]]);
  });

  it('treats __proto__ and constructor as plain names', () => {
    const params = readQuery('__proto__=x&constructor=y&__proto__=z');

    expect(params.get('__proto__')).toEqual(['x', 'z']);
    expect(params.get('constructor')).toEqual(['y']);
  });

  it('returns nothing for an empty query', () => {
    expect(readQuery('').size).toBe(0);
  });
});

describe('normalizeToken', () => {
  it('strips case, spacing and separators', () => {
    expect(normalizeToken('  Not_Paid ')).toBe('notpaid');
    expect(normalizeToken('user-cancelled')).toBe('usercancelled');
  });
});
