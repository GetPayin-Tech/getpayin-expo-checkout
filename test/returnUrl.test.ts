import { describe, expect, it } from 'vitest';

import { cancelledResult, matchesReturnUrl, readCheckoutResult } from '../src/core/returnUrl';
import { CheckoutStatus } from '../src/types';

const RETURN_URL = 'myapp://payment-return';

describe('matchesReturnUrl', () => {
  it('matches the configured link whatever query it carries', () => {
    expect(matchesReturnUrl('myapp://payment-return?status=paid&invoice_id=7', RETURN_URL)).toBe(
      true,
    );
  });

  it('ignores a trailing slash and the scheme case', () => {
    expect(matchesReturnUrl('MyApp://payment-return/', RETURN_URL)).toBe(true);
  });

  it('ignores a fragment', () => {
    expect(matchesReturnUrl('myapp://payment-return#done', RETURN_URL)).toBe(true);
  });

  it('rejects another scheme on the same host', () => {
    expect(matchesReturnUrl('otherapp://payment-return', RETURN_URL)).toBe(false);
  });

  it('rejects a different path under the same scheme', () => {
    expect(matchesReturnUrl('myapp://payment-return/extra', RETURN_URL)).toBe(false);
  });

  it('rejects the checkout page itself', () => {
    expect(matchesReturnUrl('https://pay.getpayin.com/checkout/abc', RETURN_URL)).toBe(false);
  });

  it('rejects an unparseable value', () => {
    expect(matchesReturnUrl('not a url', RETURN_URL)).toBe(false);
  });
});

describe('readCheckoutResult', () => {
  it('reads a paid return link', () => {
    const result = readCheckoutResult('myapp://payment-return?status=paid&invoice_id=INV-1');

    expect(result.status).toBe(CheckoutStatus.Paid);
    expect(result.invoiceId).toBe('INV-1');
    expect(result.returnUrl).toBe('myapp://payment-return?status=paid&invoice_id=INV-1');
  });

  it.each([
    ['status=paid', CheckoutStatus.Paid],
    ['status=success', CheckoutStatus.Paid],
    ['status=COMPLETED', CheckoutStatus.Paid],
    ['status=authorised', CheckoutStatus.Paid],
    ['paid_status=paid', CheckoutStatus.Paid],
    ['paymentStatus=succeeded', CheckoutStatus.Paid],
    ['status=not_paid', CheckoutStatus.NotPaid],
    ['status=notpaid', CheckoutStatus.NotPaid],
    ['status=declined', CheckoutStatus.NotPaid],
    ['status=failed', CheckoutStatus.NotPaid],
    ['status=cancelled', CheckoutStatus.Cancelled],
    ['status=canceled', CheckoutStatus.Cancelled],
  ])('maps %s to %s', (query, expected) => {
    expect(readCheckoutResult(`myapp://payment-return?${query}`).status).toBe(expected);
  });

  it.each([
    ['success=true', CheckoutStatus.Paid],
    ['success=1', CheckoutStatus.Paid],
    ['success=false', CheckoutStatus.NotPaid],
    ['success=0', CheckoutStatus.NotPaid],
  ])('falls back to the success flag for %s', (query, expected) => {
    expect(readCheckoutResult(`myapp://payment-return?${query}`).status).toBe(expected);
  });

  it.each(['invoice_id', 'invoiceId', 'INVOICE-ID', 'invoice', 'invoiceNumber', 'id'])(
    'reads the invoice from %s',
    (key) => {
      const result = readCheckoutResult(`myapp://payment-return?status=paid&${key}=INV-9`);

      expect(result.invoiceId).toBe('INV-9');
    },
  );

  it.each(['message', 'error', 'error_message', 'reason', 'description'])(
    'reads the message from %s',
    (key) => {
      const result = readCheckoutResult(
        `myapp://payment-return?status=not_paid&${key}=Card%20declined`,
      );

      expect(result.message).toBe('Card declined');
    },
  );

  it('decodes a plus as a space', () => {
    const result = readCheckoutResult(
      'myapp://payment-return?status=not_paid&message=Card+declined',
    );

    expect(result.message).toBe('Card declined');
  });

  it('leaves a malformed escape sequence alone rather than throwing', () => {
    const result = readCheckoutResult('myapp://payment-return?status=not_paid&message=100%25%ZZ');

    expect(result.status).toBe(CheckoutStatus.NotPaid);
    expect(result.message).toContain('%ZZ');
  });

  it('reports an unreadable return link as not paid, never as paid', () => {
    const result = readCheckoutResult('myapp://payment-return?foo=bar');

    expect(result.status).toBe(CheckoutStatus.NotPaid);
    expect(result.message).toMatch(/does not recognise|recognises/i);
  });

  it('reports a status it does not know as not paid', () => {
    const result = readCheckoutResult('myapp://payment-return?status=weird-new-state');

    expect(result.status).toBe(CheckoutStatus.NotPaid);
  });

  it('ignores a blank parameter and keeps looking', () => {
    const result = readCheckoutResult('myapp://payment-return?status=&success=true');

    expect(result.status).toBe(CheckoutStatus.Paid);
  });

  it('prefers the first occurrence of a repeated parameter', () => {
    const result = readCheckoutResult('myapp://payment-return?status=paid&status=failed');

    expect(result.status).toBe(CheckoutStatus.Paid);
  });

  it('omits the invoice and message when the link carries neither', () => {
    const result = readCheckoutResult('myapp://payment-return?status=paid');

    expect(result.invoiceId).toBeUndefined();
    expect(result.message).toBeUndefined();
  });

  it('reports an unparseable return link as not paid', () => {
    const result = readCheckoutResult('nonsense');

    expect(result.status).toBe(CheckoutStatus.NotPaid);
    expect(result.returnUrl).toBe('nonsense');
  });

  it('lets a status resolver override the built-in reader', () => {
    const result = readCheckoutResult('myapp://payment-return?outcome=settled&ref=A1', (params) =>
      params.outcome === 'settled'
        ? { status: CheckoutStatus.Paid, invoiceId: params.ref }
        : undefined,
    );

    expect(result).toMatchObject({ status: CheckoutStatus.Paid, invoiceId: 'A1' });
  });

  it('falls back to the built-in reader when the resolver returns nothing', () => {
    const result = readCheckoutResult('myapp://payment-return?status=paid', () => undefined);

    expect(result.status).toBe(CheckoutStatus.Paid);
  });

  it('hands the resolver normalised parameter names', () => {
    readCheckoutResult('myapp://payment-return?Invoice_Id=7', (params) => {
      expect(params.invoiceid).toBe('7');

      return undefined;
    });
  });
});

describe('cancelledResult', () => {
  it('reports a cancellation with no invoice', () => {
    expect(cancelledResult()).toEqual({ status: CheckoutStatus.Cancelled });
  });

  it('carries a reason when one is given', () => {
    expect(cancelledResult('closed')).toEqual({
      status: CheckoutStatus.Cancelled,
      message: 'closed',
    });
  });
});
