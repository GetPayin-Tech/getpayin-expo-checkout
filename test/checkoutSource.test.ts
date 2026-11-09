import { describe, expect, it } from 'vitest';

import { buildCheckoutSource } from '../src/webview/checkoutSource';

const CHECKOUT_URL = 'https://pay.getpayin.com/checkout/abc';
const RETURN_URL = 'myapp://payment-return';

describe('buildCheckoutSource', () => {
  it('loads the checkout when every prop is usable', () => {
    expect(buildCheckoutSource(` ${CHECKOUT_URL} `, RETURN_URL, 4512)).toEqual({
      uri: CHECKOUT_URL,
      returnUrl: RETURN_URL,
      expectedInvoiceId: '4512',
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

  it('hands back no invoice id when none was given', () => {
    expect(
      buildCheckoutSource(CHECKOUT_URL, RETURN_URL, undefined).expectedInvoiceId,
    ).toBeUndefined();
  });

  /*
   * `checkoutUrl` arrives from a server at runtime, so an undefined one is a real shape.
   * It throws a TypeError out of `trim()` rather than a GetPayInCheckoutError, and that
   * must still be a value the view can report rather than a thrown render.
   */
  it('reports a failure that is not a checkout error of ours', () => {
    const source = buildCheckoutSource(undefined as unknown as string, RETURN_URL, 4512);

    expect(source.uri).toBe('about:blank');
    expect(source.error).toMatch(/TypeError/);
  });

  it('hands back the id as it will be compared, not as it was passed', () => {
    expect(buildCheckoutSource(CHECKOUT_URL, RETURN_URL, ' 004512 ').expectedInvoiceId).toBe(
      '4512',
    );
  });
});
