import { describe, expect, it } from 'vitest';

import { buildCheckoutSource } from '../src/webview/checkoutSource';

const CHECKOUT_URL = 'https://pay.getpayin.com/checkout/abc';
const RETURN_URL = 'myapp://payment-return';

describe('buildCheckoutSource', () => {
  it('loads the checkout when every prop is usable', () => {
    expect(buildCheckoutSource(` ${CHECKOUT_URL} `, RETURN_URL, 4512)).toEqual({
      uri: CHECKOUT_URL,
      returnUrl: RETURN_URL,
    });
  });

  it('loads the checkout when no invoice id is given', () => {
    expect(buildCheckoutSource(CHECKOUT_URL, RETURN_URL, undefined).error).toBeUndefined();
  });

  it.each([
    ['a null invoice id', CHECKOUT_URL, RETURN_URL, null],
    ['an empty invoice id', CHECKOUT_URL, RETURN_URL, ''],
    ['an object as the invoice id', CHECKOUT_URL, RETURN_URL, { invoice_id: 4512 }],
    ['a checkout URL that is not http(s)', 'myapp://checkout', RETURN_URL, 4512],
    ['a return link with no scheme', CHECKOUT_URL, 'payment-return', 4512],
  ])('reports %s as an error instead of throwing', (_label, checkoutUrl, returnUrl, invoiceId) => {
    const source = buildCheckoutSource(checkoutUrl, returnUrl, invoiceId);

    expect(source.uri).toBe('about:blank');
    expect(source.error).toEqual(expect.any(String));
  });

  it('names the bad invoice id in the error', () => {
    expect(buildCheckoutSource(CHECKOUT_URL, RETURN_URL, null).error).toMatch(/expectedInvoiceId/);
  });
});
