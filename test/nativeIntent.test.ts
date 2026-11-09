import { describe, expect, it } from 'vitest';

import { createPaymentReturnRedirect } from '../src/nativeIntent';

const redirect = createPaymentReturnRedirect('myapp://payment-return');

describe('createPaymentReturnRedirect', () => {
  it('sends a cold start to the first screen instead of an unmatched route', () => {
    expect(redirect({ path: '/payment-return?status=paid', initial: true })).toBe('/');
  });

  it('drops the link when the app is already running and has the result', () => {
    expect(redirect({ path: '/payment-return?status=paid', initial: false })).toBeNull();
  });

  it('matches the marker whatever the separator style', () => {
    expect(redirect({ path: 'payment_return', initial: false })).toBeNull();
  });

  it('leaves every other route alone', () => {
    expect(redirect({ path: '/orders/42', initial: false })).toBe('/orders/42');
    expect(redirect({ path: '/orders/42', initial: true })).toBe('/orders/42');
  });

  it.each(['/help/payment-returns-policy', '/payment-returns', '/orders/payment-return-faq'])(
    'leaves %s alone, matching whole segments rather than substrings',
    (path) => {
      expect(redirect({ path, initial: false })).toBe(path);
    },
  );

  it('still matches the return route nested under another segment', () => {
    expect(redirect({ path: '/app/payment-return?status=paid', initial: false })).toBeNull();
  });

  it('honours a custom initial path', () => {
    const toHome = createPaymentReturnRedirect('myapp://payment-return', '/home');

    expect(toHome({ path: '/payment-return', initial: true })).toBe('/home');
  });

  it('swallows nothing when the return link yields no segments to match on', () => {
    const empty = createPaymentReturnRedirect('');

    expect(empty({ path: '/payment-return', initial: false })).toBe('/payment-return');
    expect(empty({ path: '/', initial: true })).toBe('/');
  });

  it('falls back to matching the raw value when the return link has no scheme', () => {
    const loose = createPaymentReturnRedirect('payment-return');

    expect(loose({ path: '/payment-return', initial: false })).toBeNull();
  });
});
