import { describe, expect, it } from 'vitest';

import { resolveReturn } from '../src/core/returnUrl';
import { CheckoutStatus } from '../src/types';

const RETURN_URL = 'myapp://payment-return';

describe('resolveReturn binds a link to the invoice it was opened for', () => {
  it('accepts a paid link for the expected invoice', () => {
    const result = resolveReturn(`${RETURN_URL}?status=paid&invoice_id=INV-1`, {
      expectedInvoiceId: 'INV-1',
    });

    expect(result.status).toBe(CheckoutStatus.Paid);
    expect(result.invoiceId).toBe('INV-1');
  });

  it('refuses a paid link that names a different invoice', () => {
    const result = resolveReturn(`${RETURN_URL}?status=paid&invoice_id=INV-ATTACKER`, {
      expectedInvoiceId: 'INV-1',
    });

    expect(result.status).toBe(CheckoutStatus.NotPaid);
    expect(result.message).toMatch(/different invoice/i);
  });

  it('refuses a paid link that names no invoice at all', () => {
    const result = resolveReturn(`${RETURN_URL}?status=paid`, { expectedInvoiceId: 'INV-1' });

    expect(result.status).toBe(CheckoutStatus.NotPaid);
  });

  it('takes a link at its word when no invoice was supplied to bind to', () => {
    expect(resolveReturn(`${RETURN_URL}?status=paid&invoice_id=INV-9`, {}).status).toBe(
      CheckoutStatus.Paid,
    );
  });

  it('leaves a decline alone rather than rewriting the reason the payer was given', () => {
    const result = resolveReturn(`${RETURN_URL}?status=not_paid&message=Card+declined`, {
      expectedInvoiceId: 'INV-1',
    });

    expect(result.status).toBe(CheckoutStatus.NotPaid);
    expect(result.message).toBe('Card declined');
  });

  it('leaves a cancellation alone', () => {
    const result = resolveReturn(`${RETURN_URL}?status=cancelled`, {
      expectedInvoiceId: 'INV-1',
    });

    expect(result.status).toBe(CheckoutStatus.Cancelled);
  });

  it('still applies a status resolver before binding', () => {
    const result = resolveReturn(`${RETURN_URL}?outcome=settled&ref=INV-1`, {
      statusResolver: (params) =>
        params.outcome === 'settled'
          ? { status: CheckoutStatus.Paid, invoiceId: params.ref }
          : undefined,
      expectedInvoiceId: 'INV-1',
    });

    expect(result.status).toBe(CheckoutStatus.Paid);
  });
});
