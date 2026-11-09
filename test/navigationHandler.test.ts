import { describe, expect, it, vi } from 'vitest';

import { CheckoutStatus } from '../src/types';
import { createNavigationHandler } from '../src/webview/navigationHandler';

const RETURN_URL = 'myapp://payment-return';

function buildHandler(overrides: { statusResolver?: never } = {}) {
  const onComplete = vi.fn();
  const onExternal = vi.fn();
  const handler = createNavigationHandler({
    returnUrl: RETURN_URL,
    onComplete,
    onExternal,
    ...overrides,
  });

  return { handler, onComplete, onExternal };
}

describe('createNavigationHandler', () => {
  it('lets the checkout itself load', () => {
    const { handler, onComplete, onExternal } = buildHandler();

    expect(handler('https://pay.getpayin.com/checkout/abc')).toBe(true);
    expect(onComplete).not.toHaveBeenCalled();
    expect(onExternal).not.toHaveBeenCalled();
  });

  it('completes on the return link and stops the navigation', () => {
    const { handler, onComplete } = buildHandler();

    expect(handler('myapp://payment-return?status=paid&invoice_id=INV-3')).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]?.[0]).toMatchObject({
      status: CheckoutStatus.Paid,
      invoiceId: 'INV-3',
    });
  });

  it('completes at most once, however often the return link arrives', () => {
    const { handler, onComplete } = buildHandler();

    expect(handler('myapp://payment-return?status=paid')).toBe(false);
    expect(handler('myapp://payment-return?status=not_paid')).toBe(false);
    expect(handler('myapp://payment-return?status=paid')).toBe(false);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]?.[0]).toMatchObject({ status: CheckoutStatus.Paid });
  });

  it('hands a bank app the 3-D Secure step without completing', () => {
    const { handler, onComplete, onExternal } = buildHandler();

    expect(handler('mybank://authorise/3ds/9')).toBe(false);
    expect(onExternal).toHaveBeenCalledWith('mybank://authorise/3ds/9');
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('keeps working after a bank app step', () => {
    const { handler, onComplete } = buildHandler();

    handler('mybank://authorise/3ds/9');

    expect(handler('myapp://payment-return?status=paid')).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('refuses a script scheme without completing or opening anything', () => {
    const { handler, onComplete, onExternal } = buildHandler();

    expect(handler('javascript:alert(document.cookie)')).toBe(false);
    expect(onExternal).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('refuses a return link naming an invoice other than the one opened', () => {
    const onComplete = vi.fn();
    const handler = createNavigationHandler({
      returnUrl: RETURN_URL,
      expectedInvoiceId: 'INV-REAL',
      onComplete,
      onExternal: vi.fn(),
    });

    handler('myapp://payment-return?status=paid&invoice_id=INV-ATTACKER');

    expect(onComplete.mock.calls[0]?.[0]).toMatchObject({ status: CheckoutStatus.NotPaid });
  });

  it('accepts a return link for the invoice it was opened for', () => {
    const onComplete = vi.fn();
    const handler = createNavigationHandler({
      returnUrl: RETURN_URL,
      expectedInvoiceId: 'INV-REAL',
      onComplete,
      onExternal: vi.fn(),
    });

    handler('myapp://payment-return?status=paid&invoice_id=INV-REAL');

    expect(onComplete.mock.calls[0]?.[0]).toMatchObject({ status: CheckoutStatus.Paid });
  });

  it('uses a status resolver when one is supplied', () => {
    const onComplete = vi.fn();
    const handler = createNavigationHandler({
      returnUrl: RETURN_URL,
      statusResolver: (params) =>
        params.outcome === 'settled' ? { status: CheckoutStatus.Paid } : undefined,
      onComplete,
      onExternal: vi.fn(),
    });

    handler('myapp://payment-return?outcome=settled');

    expect(onComplete.mock.calls[0]?.[0]).toMatchObject({ status: CheckoutStatus.Paid });
  });
});
