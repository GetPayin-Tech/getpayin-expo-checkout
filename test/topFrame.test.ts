import { describe, expect, it, vi } from 'vitest';

import { CheckoutStatus } from '../src/types';
import { createNavigationHandler } from '../src/webview/navigationHandler';
import { isTopFrameRequest } from '../src/webview/topFrame';

const RETURN_URL = 'myapp://payment-return';

/** The return link exactly as GetPayIn's app-return bridge sends it. */
const PAID_RETURN =
  'myapp://payment-return?success=1&invoice_id=4512&invoice_status=PAID&message=Paid&signature=abc';

/** A request as Android's web view hands it over: the flag is simply not there. */
type WebViewRequest = { readonly url: string; readonly isTopFrame?: boolean };

describe('isTopFrameRequest', () => {
  it('takes the flag as it is when the web view sends one', () => {
    for (const platform of ['ios', 'android']) {
      expect(isTopFrameRequest({ isTopFrame: true }, platform)).toBe(true);
      expect(isTopFrameRequest({ isTopFrame: false }, platform)).toBe(false);
    }
  });

  // react-native-webview 14 leaves the flag out of every Android request in a release build.
  it('reads a missing flag on Android as the page itself', () => {
    expect(isTopFrameRequest({}, 'android')).toBe(true);
  });

  it('reads a missing flag anywhere else as a frame', () => {
    expect(isTopFrameRequest({}, 'ios')).toBe(false);
    expect(isTopFrameRequest({}, 'web')).toBe(false);
  });

  it('lets an Android return link with no flag finish the checkout', () => {
    const onComplete = vi.fn();
    const handler = createNavigationHandler({
      returnUrl: RETURN_URL,
      ownSchemes: [],
      expectedInvoiceId: 4512,
      onComplete,
      onExternal: vi.fn(),
    });
    const request: WebViewRequest = { url: PAID_RETURN };

    expect(handler({ url: request.url, isTopFrame: isTopFrameRequest(request, 'android') })).toBe(
      false,
    );
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ status: CheckoutStatus.Paid, invoiceId: '4512' }),
    );
  });

  it('still refuses an iOS return link with no flag', () => {
    const onComplete = vi.fn();
    const handler = createNavigationHandler({
      returnUrl: RETURN_URL,
      ownSchemes: [],
      onComplete,
      onExternal: vi.fn(),
    });
    const request: WebViewRequest = { url: PAID_RETURN };

    expect(handler({ url: request.url, isTopFrame: isTopFrameRequest(request, 'ios') })).toBe(
      false,
    );
    expect(onComplete).not.toHaveBeenCalled();
  });
});
