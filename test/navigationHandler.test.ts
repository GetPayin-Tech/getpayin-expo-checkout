import { describe, expect, it, vi } from 'vitest';

import { CheckoutResultCode, CheckoutStatus } from '../src/types';
import { createNavigationHandler } from '../src/webview/navigationHandler';
import type { NavigationHandlerOptions } from '../src/webview/navigationHandler';

const RETURN_URL = 'myapp://payment-return';

function buildHandler(overrides: Partial<NavigationHandlerOptions> = {}) {
  const onComplete = vi.fn();
  const onExternal = vi.fn();
  const handler = createNavigationHandler({
    returnUrl: RETURN_URL,
    ownSchemes: [],
    onComplete,
    onExternal,
    ...overrides,
  });

  return {
    /** The page itself navigating, which is the ordinary case. */
    navigate: (url: string) => handler({ url, isTopFrame: true }),
    /** A frame inside the checkout page navigating. */
    navigateInFrame: (url: string) => handler({ url, isTopFrame: false }),
    onComplete,
    onExternal,
  };
}

describe('createNavigationHandler', () => {
  it('lets the checkout itself load', () => {
    const { navigate, onComplete, onExternal } = buildHandler();

    expect(navigate('https://pay.getpayin.com/checkout/abc')).toBe(true);
    expect(onComplete).not.toHaveBeenCalled();
    expect(onExternal).not.toHaveBeenCalled();
  });

  it('completes on the return link and stops the navigation', () => {
    const { navigate, onComplete } = buildHandler();

    expect(navigate('myapp://payment-return?success=1&invoice_id=INV-3')).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]?.[0]).toMatchObject({
      status: CheckoutStatus.Paid,
      invoiceId: 'INV-3',
    });
  });

  it('completes at most once, however often the return link arrives', () => {
    const { navigate, onComplete } = buildHandler();

    expect(navigate('myapp://payment-return?success=1')).toBe(false);
    expect(navigate('myapp://payment-return?success=0')).toBe(false);
    expect(navigate('myapp://payment-return?success=1')).toBe(false);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]?.[0]).toMatchObject({ status: CheckoutStatus.Paid });
  });

  it('hands a bank app the 3-D Secure step without completing', () => {
    const { navigate, onComplete, onExternal } = buildHandler();

    expect(navigate('mybank://authorise/3ds/9')).toBe(false);
    expect(onExternal).toHaveBeenCalledWith('mybank://authorise/3ds/9');
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('keeps working after a bank app step', () => {
    const { navigate, onComplete } = buildHandler();

    navigate('mybank://authorise/3ds/9');

    expect(navigate('myapp://payment-return?success=1')).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("refuses the host app's other schemes without opening anything", () => {
    const { navigate, onExternal } = buildHandler({ ownSchemes: ['com.shop.app'] });

    expect(navigate('com.shop.app://orders/1/cancel')).toBe(false);
    expect(onExternal).not.toHaveBeenCalled();
  });

  it('refuses a script scheme without completing or opening anything', () => {
    const { navigate, onComplete, onExternal } = buildHandler();

    expect(navigate('javascript:alert(document.cookie)')).toBe(false);
    expect(onExternal).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('refuses a return link naming an invoice other than the one opened', () => {
    const { navigate, onComplete } = buildHandler({ expectedInvoiceId: 'INV-REAL' });

    navigate('myapp://payment-return?success=1&invoice_id=INV-ATTACKER');

    expect(onComplete.mock.calls[0]?.[0]).toMatchObject({
      status: CheckoutStatus.NotPaid,
      code: CheckoutResultCode.WrongInvoice,
    });
  });

  it('accepts a return link for the invoice it was opened for', () => {
    const { navigate, onComplete } = buildHandler({ expectedInvoiceId: 'INV-REAL' });

    navigate('myapp://payment-return?success=1&invoice_id=INV-REAL');

    expect(onComplete.mock.calls[0]?.[0]).toMatchObject({ status: CheckoutStatus.Paid });
  });

  it('accepts the number the server reported against the text in the link', () => {
    const { navigate, onComplete } = buildHandler({ expectedInvoiceId: 4512 });

    navigate('myapp://payment-return?success=1&invoice_id=4512');

    expect(onComplete.mock.calls[0]?.[0]).toMatchObject({ status: CheckoutStatus.Paid });
  });

  /*
   * The 3-D Secure page is hosted by the issuer and knows the real invoice id, so an
   * iframe pointing itself at the return link would otherwise report a payment that was
   * never made — and expectedInvoiceId is no defence, because the id is genuine.
   */
  it('does not complete on a return link asked for by a frame inside the page', () => {
    const { navigateInFrame, onComplete } = buildHandler({ expectedInvoiceId: '4512' });

    expect(navigateInFrame('myapp://payment-return?success=1&invoice_id=4512')).toBe(false);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('does not open an app for a frame inside the page', () => {
    const { navigateInFrame, onExternal } = buildHandler();

    expect(navigateInFrame('mybank://authorise/3ds/9')).toBe(false);
    expect(onExternal).not.toHaveBeenCalled();
  });

  it('still lets a frame inside the page load the 3-D Secure step itself', () => {
    const { navigateInFrame } = buildHandler();

    expect(navigateInFrame('https://3ds.issuer.example/challenge')).toBe(true);
  });

  it('completes on a genuine return link after a frame tried the same link', () => {
    const { navigate, navigateInFrame, onComplete } = buildHandler();

    navigateInFrame('myapp://payment-return?success=1&invoice_id=4512');

    expect(navigate('myapp://payment-return?success=1&invoice_id=4512')).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]?.[0]).toMatchObject({ status: CheckoutStatus.Paid });
  });
});
