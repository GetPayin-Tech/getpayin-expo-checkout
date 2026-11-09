import { describe, expect, it } from 'vitest';

import { cancelledResult, matchesReturnUrl, readCheckoutResult } from '../src/core/returnUrl';
import { CheckoutStatus } from '../src/types';

const RETURN_URL = 'myapp://payment-return';

describe('matchesReturnUrl', () => {
  it('matches the configured link whatever query it carries', () => {
    expect(matchesReturnUrl('myapp://payment-return?success=1&invoice_id=7', RETURN_URL)).toBe(
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
  // The link exactly as GetPayIn's app-return bridge builds it (http_build_query).
  const PAID_LINK =
    'myapp://payment-return?success=1&invoice_id=4512&invoice_status=PAID' +
    '&message=Payment+completed&signature=c2lnbmF0dXJl&auth_code=831204';

  it("reads GetPayIn's paid return link", () => {
    const result = readCheckoutResult(PAID_LINK);

    expect(result).toEqual({
      status: CheckoutStatus.Paid,
      invoiceId: '4512',
      message: 'Payment completed',
      returnUrl: PAID_LINK,
    });
  });

  it("reads GetPayIn's declined return link", () => {
    const result = readCheckoutResult(
      'myapp://payment-return?success=0&invoice_id=4512&invoice_status=UNPAID' +
        '&message=Card+declined&signature=c2lnbmF0dXJl',
    );

    expect(result).toMatchObject({
      status: CheckoutStatus.NotPaid,
      invoiceId: '4512',
      message: 'Card declined',
    });
  });

  it.each(['success=true', 'success=yes', 'success=2', 'status=paid', 'paid=1', 'result=success'])(
    'does not accept %s, which GetPayIn never sends',
    (query) => {
      const result = readCheckoutResult(`myapp://payment-return?${query}&invoice_id=4512`);

      expect(result.status).toBe(CheckoutStatus.NotPaid);
      expect(result.message).toMatch(/recognises/i);
    },
  );

  it.each(['success=%201%20', 'success=+1', 'Success=1', 'SUCCESS=1', 'success_=1'])(
    'does not accept %s: the flag is read by its exact name and value',
    (query) => {
      expect(readCheckoutResult(`myapp://payment-return?${query}`).status).toBe(
        CheckoutStatus.NotPaid,
      );
    },
  );

  it.each([
    ['success', 'success=1&success=0&invoice_id=4512'],
    ['invoice_id', 'success=1&invoice_id=4512&invoice_id=5001'],
    ['message', 'success=1&invoice_id=4512&message=a&message=b'],
  ])('treats a link that repeats %s as unreadable', (_field, query) => {
    const result = readCheckoutResult(`myapp://payment-return?${query}`);

    expect(result.status).toBe(CheckoutStatus.NotPaid);
    expect(result.invoiceId).toBeUndefined();
    expect(result.message).toMatch(/recognises/i);
  });

  it('is not thrown off by a __proto__ field', () => {
    expect(
      readCheckoutResult('myapp://payment-return?__proto__=x&success=1&invoice_id=4512').status,
    ).toBe(CheckoutStatus.Paid);
  });

  it('leaves a malformed escape sequence alone rather than throwing', () => {
    const result = readCheckoutResult('myapp://payment-return?success=0&message=100%25%ZZ');

    expect(result.status).toBe(CheckoutStatus.NotPaid);
    expect(result.message).toContain('%ZZ');
  });

  it('reports a link without the success flag as not paid, never as paid', () => {
    const result = readCheckoutResult('myapp://payment-return?invoice_id=4512');

    expect(result.status).toBe(CheckoutStatus.NotPaid);
    expect(result.message).toMatch(/recognises/i);
  });

  it('reports a blank success flag as unreadable', () => {
    const result = readCheckoutResult('myapp://payment-return?success=&invoice_id=4512');

    expect(result.status).toBe(CheckoutStatus.NotPaid);
    expect(result.message).toMatch(/recognises/i);
  });

  it('omits the invoice and message when the link carries neither', () => {
    const result = readCheckoutResult('myapp://payment-return?success=1');

    expect(result.invoiceId).toBeUndefined();
    expect(result.message).toBeUndefined();
  });

  it('reports an unparseable return link as not paid', () => {
    const result = readCheckoutResult('nonsense');

    expect(result.status).toBe(CheckoutStatus.NotPaid);
    expect(result.returnUrl).toBe('nonsense');
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
