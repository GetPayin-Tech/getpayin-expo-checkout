import { describe, expect, it } from 'vitest';

import { cancelledResult, matchesReturnUrl, readCheckoutResult } from '../src/core/returnUrl';
import { CheckoutResultCode, CheckoutStatus } from '../src/types';

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
      invoiceStatus: 'PAID',
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

  /*
   * GetPayIn's bridge always sends a message, so without a code of its own an unreadable
   * link would arrive looking exactly like a genuine decline — and nothing would be left
   * to alert on when the backend and this reader stop agreeing about the link's shape.
   */
  it('marks an unreadable link with a code a genuine decline does not carry', () => {
    const unreadable = readCheckoutResult(
      'myapp://payment-return?invoice_id=4512&message=Payment+declined',
    );
    const declined = readCheckoutResult(
      'myapp://payment-return?success=0&invoice_id=4512&message=Payment+declined',
    );

    expect(unreadable.code).toBe(CheckoutResultCode.UnreadableReturnLink);
    expect(declined.code).toBeUndefined();
  });

  it("does not show the payer the link's own message when it could not be read", () => {
    const result = readCheckoutResult(
      'myapp://payment-return?success=true&invoice_id=4512&message=Payment+completed',
    );

    expect(result.status).toBe(CheckoutStatus.NotPaid);
    expect(result.message).toMatch(/recognises/i);
    expect(result.invoiceId).toBeUndefined();
  });

  it('treats a blank message as no message at all', () => {
    expect(
      readCheckoutResult('myapp://payment-return?success=0&message=+').message,
    ).toBeUndefined();
  });

  it.each([
    ['a repeated signature, which is what a server disambiguates on', 'signature=a&signature=b'],
    ['a repeated field GetPayIn adds later', 'auth_code=1&auth_code=2'],
  ])('treats a link that repeats %s as unreadable', (_label, extra) => {
    const result = readCheckoutResult(`myapp://payment-return?success=1&invoice_id=4512&${extra}`);

    expect(result.status).toBe(CheckoutStatus.NotPaid);
    expect(result.code).toBe(CheckoutResultCode.UnreadableReturnLink);
  });

  /*
   * A server checking the signature over the raw query string reads these names one way
   * and a reader that folds case, ignores separators or decodes names reads them another.
   * The link is refused rather than read differently by the two.
   */
  it.each([
    ['a case variant of the flag', 'Success=0&success=1&invoice_id=7'],
    ['an upper-case variant of the flag', 'SUCCESS=0&success=1&invoice_id=7'],
    ['a percent-encoded field name', '%73uccess=1&invoice_id=7'],
    ['an invoice id written in another style', 'success=1&invoiceId=5001&invoice_id=7'],
    ['a separator variant of the status', 'success=1&invoice-status=PAID&invoice_id=7'],
  ])('refuses %s as unreadable', (_label, query) => {
    const result = readCheckoutResult(`myapp://payment-return?${query}`);

    expect(result.status).toBe(CheckoutStatus.NotPaid);
    expect(result.code).toBe(CheckoutResultCode.UnreadableReturnLink);
  });

  it('reads the invoice status the link reported', () => {
    expect(
      readCheckoutResult('myapp://payment-return?success=1&invoice_id=4512&invoice_status=PAID')
        .invoiceStatus,
    ).toBe('PAID');
  });

  it.each(['PARTIALLY_PAID', 'AUTHORIZED', 'UNPAID', 'REFUNDED'])(
    'refuses a paid flag carrying invoice_status=%s, which is not an order to fulfil',
    (invoiceStatus) => {
      const result = readCheckoutResult(
        `myapp://payment-return?success=1&invoice_id=4512&invoice_status=${invoiceStatus}`,
      );

      expect(result.status).toBe(CheckoutStatus.NotPaid);
      expect(result.code).toBe(CheckoutResultCode.UnexpectedInvoiceStatus);
      expect(result.invoiceStatus).toBe(invoiceStatus);
    },
  );

  it('does not let invoice_status upgrade a declined link to paid', () => {
    const result = readCheckoutResult(
      'myapp://payment-return?success=0&invoice_id=4512&invoice_status=PAID',
    );

    expect(result.status).toBe(CheckoutStatus.NotPaid);
    expect(result.code).toBeUndefined();
  });

  it('still reads a paid link that carries no invoice status at all', () => {
    expect(readCheckoutResult('myapp://payment-return?success=1&invoice_id=4512').status).toBe(
      CheckoutStatus.Paid,
    );
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
