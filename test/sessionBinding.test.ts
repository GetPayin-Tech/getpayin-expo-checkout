import { describe, expect, it } from 'vitest';

import { resolveReturn } from '../src/core/returnUrl';
import { CheckoutResultCode, CheckoutStatus } from '../src/types';

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

    // `invoiceId` is a name a looser reader would take for `invoice_id`, so the link is
    // refused as unreadable before the invoice is even compared.
    expect(result.status).toBe(CheckoutStatus.NotPaid);
    expect(result.code).toBe(CheckoutResultCode.UnreadableReturnLink);
  });

  it('refuses a paid link that names a different number', () => {
    const result = resolveReturn(`${RETURN_URL}?success=1&invoice_id=4513`, {
      expectedInvoiceId: 4512,
    });

    expect(result.status).toBe(CheckoutStatus.NotPaid);
    expect(result.message).toMatch(/did not name the invoice this checkout was opened for/i);
  });

  it('refuses a paid link that names a different invoice', () => {
    const result = resolveReturn(`${RETURN_URL}?success=1&invoice_id=INV-ATTACKER`, {
      expectedInvoiceId: 'INV-1',
    });

    expect(result.status).toBe(CheckoutStatus.NotPaid);
    expect(result.message).toMatch(/did not name the invoice this checkout was opened for/i);
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

  it('marks a decline that names no invoice as wrong_invoice: a genuine return link always names one', () => {
    // Anything on the phone can open the return link, so a bare decline must not make the
    // app offer a retry while this checkout's invoice may be paid.
    const result = resolveReturn(`${RETURN_URL}?success=0&message=Card+declined`, {
      expectedInvoiceId: 'INV-1',
    });

    expect(result.status).toBe(CheckoutStatus.NotPaid);
    expect(result.code).toBe(CheckoutResultCode.WrongInvoice);
    // The message says what is true for a link that named no invoice as well.
    expect(result.message).toMatch(/did not name the invoice this checkout was opened for/i);
  });

  it('keeps unreadable_return_link for an unreadable link, which names no invoice either', () => {
    const result = resolveReturn(`${RETURN_URL}?success=maybe`, { expectedInvoiceId: 'INV-1' });

    expect(result.status).toBe(CheckoutStatus.NotPaid);
    expect(result.code).toBe(CheckoutResultCode.UnreadableReturnLink);
  });

  it('takes a decline that names no invoice at its word when no invoice was supplied to bind to', () => {
    const result = resolveReturn(`${RETURN_URL}?success=0&message=Card+declined`, {});

    expect(result.code).toBeUndefined();
    expect(result.message).toBe('Card declined');
  });

  it('leaves a decline for the expected invoice alone', () => {
    const result = resolveReturn(
      `${RETURN_URL}?success=0&invoice_id=4512&invoice_status=UNPAID&message=Card+declined`,
      { expectedInvoiceId: 4512 },
    );

    expect(result.status).toBe(CheckoutStatus.NotPaid);
    expect(result.code).toBeUndefined();
    expect(result.message).toBe('Card declined');
  });

  it.each([
    ['leading zeros in the link', '04512', 4512],
    ['text on both sides', '4512', '4512'],
    ['spaces around the expected id', '4512', ' 4512 '],
  ])(
    'compares a decline in one form: %s still leaves it alone',
    (_label, linkInvoiceId, expectedInvoiceId) => {
      const result = resolveReturn(
        `${RETURN_URL}?success=0&invoice_id=${linkInvoiceId}&message=Card+declined`,
        { expectedInvoiceId },
      );

      expect(result.code).toBeUndefined();
      expect(result.message).toBe('Card declined');
    },
  );

  it('counts a decline whose invoice id is present but blank as naming another invoice', () => {
    const result = resolveReturn(`${RETURN_URL}?success=0&invoice_id=+&message=Card+declined`, {
      expectedInvoiceId: 4512,
    });

    expect(result.status).toBe(CheckoutStatus.NotPaid);
    expect(result.code).toBe(CheckoutResultCode.WrongInvoice);
  });

  it.each([
    ['an empty string', ''],
    ['null from untyped code', null as unknown as string],
  ])(
    'fails closed on %s: a decline that names an invoice binds to nothing, so it is wrong_invoice',
    (_label, expectedInvoiceId) => {
      const result = resolveReturn(`${RETURN_URL}?success=0&invoice_id=4512`, {
        expectedInvoiceId,
      });

      expect(result.code).toBe(CheckoutResultCode.WrongInvoice);
    },
  );

  it('marks a decline for a different invoice as wrong_invoice, not as a decline to retry', () => {
    // A genuine decline from an earlier checkout, arriving while the checkout for 4512 is open.
    const result = resolveReturn(
      `${RETURN_URL}?success=0&invoice_id=4400&invoice_status=UNPAID&message=Card+declined`,
      { expectedInvoiceId: 4512 },
    );

    expect(result.status).toBe(CheckoutStatus.NotPaid);
    expect(result.code).toBe(CheckoutResultCode.WrongInvoice);
    expect(result.message).toMatch(/did not name the invoice this checkout was opened for/i);
  });

  it('marks a success=1 link that is not paid in full, for a different invoice, as wrong_invoice', () => {
    const result = resolveReturn(
      `${RETURN_URL}?success=1&invoice_id=4400&invoice_status=AUTHORIZED`,
      { expectedInvoiceId: 4512 },
    );

    expect(result.status).toBe(CheckoutStatus.NotPaid);
    expect(result.code).toBe(CheckoutResultCode.WrongInvoice);
  });

  it('keeps unexpected_invoice_status for a success=1 link that is not paid in full, for the expected invoice', () => {
    const result = resolveReturn(
      `${RETURN_URL}?success=1&invoice_id=4512&invoice_status=AUTHORIZED`,
      { expectedInvoiceId: 4512 },
    );

    expect(result.status).toBe(CheckoutStatus.NotPaid);
    expect(result.code).toBe(CheckoutResultCode.UnexpectedInvoiceStatus);
  });
});
