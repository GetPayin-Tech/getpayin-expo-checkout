import { describe, expect, it } from 'vitest';

import { resolveReturn } from '../src/core/returnUrl';
import { CheckoutStatus } from '../src/types';

const RETURN_URL = 'myapp://payment-return';

describe('resolveReturn binds a link to the invoice it was opened for', () => {
  it('accepts a paid link for the expected invoice', () => {
    const result = resolveReturn(`${RETURN_URL}?success=1&invoice_id=INV-1`, {
      expectedInvoiceId: 'INV-1',
    });

    expect(result.status).toBe(CheckoutStatus.Paid);
    expect(result.invoiceId).toBe('INV-1');
  });

  it('accepts the invoice id as the number GetPayIn returns from init', () => {
    const result = resolveReturn(`${RETURN_URL}?success=1&invoice_id=4512`, {
      expectedInvoiceId: 4512,
    });

    expect(result.status).toBe(CheckoutStatus.Paid);
    expect(result.invoiceId).toBe('4512');
  });

  it('ignores spaces around the expected invoice id', () => {
    const result = resolveReturn(`${RETURN_URL}?success=1&invoice_id=4512`, {
      expectedInvoiceId: ' 4512 ',
    });

    expect(result.status).toBe(CheckoutStatus.Paid);
  });

  it.each([
    ['an empty string', ''],
    ['null from untyped code', null as unknown as string],
  ])(
    'fails closed on %s: a paid link binds to nothing, so it is refused',
    (_label, expectedInvoiceId) => {
      const result = resolveReturn(`${RETURN_URL}?success=1&invoice_id=4512`, {
        expectedInvoiceId,
      });

      expect(result.status).toBe(CheckoutStatus.NotPaid);
    },
  );

  it('refuses a genuine link for another invoice with an extra invoiceId put in front', () => {
    // A real signed link for invoice 4000, replayed for a new checkout of invoice 5001.
    const replayed =
      `${RETURN_URL}?invoiceId=5001&success=1&invoice_id=4000` +
      '&invoice_status=PAID&signature=c2lnbmF0dXJl';

    const result = resolveReturn(replayed, { expectedInvoiceId: 5001 });

    expect(result.status).toBe(CheckoutStatus.NotPaid);
    expect(result.message).toMatch(/different invoice/i);
  });

  it('refuses a paid link that names a different number', () => {
    const result = resolveReturn(`${RETURN_URL}?success=1&invoice_id=4513`, {
      expectedInvoiceId: 4512,
    });

    expect(result.status).toBe(CheckoutStatus.NotPaid);
    expect(result.message).toMatch(/different invoice/i);
  });

  it('refuses a paid link that names a different invoice', () => {
    const result = resolveReturn(`${RETURN_URL}?success=1&invoice_id=INV-ATTACKER`, {
      expectedInvoiceId: 'INV-1',
    });

    expect(result.status).toBe(CheckoutStatus.NotPaid);
    expect(result.message).toMatch(/different invoice/i);
  });

  it('refuses a paid link that names no invoice at all', () => {
    const result = resolveReturn(`${RETURN_URL}?success=1`, { expectedInvoiceId: 'INV-1' });

    expect(result.status).toBe(CheckoutStatus.NotPaid);
  });

  it('takes a link at its word when no invoice was supplied to bind to', () => {
    expect(resolveReturn(`${RETURN_URL}?success=1&invoice_id=INV-9`, {}).status).toBe(
      CheckoutStatus.Paid,
    );
  });

  it('leaves a decline alone rather than rewriting the reason the payer was given', () => {
    const result = resolveReturn(`${RETURN_URL}?success=0&message=Card+declined`, {
      expectedInvoiceId: 'INV-1',
    });

    expect(result.status).toBe(CheckoutStatus.NotPaid);
    expect(result.message).toBe('Card declined');
  });
});
