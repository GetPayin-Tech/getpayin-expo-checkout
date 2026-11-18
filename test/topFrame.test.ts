import { describe, expect, it, vi } from 'vitest';

import { CheckoutStatus } from '../src/types';
import { createNavigationHandler } from '../src/webview/navigationHandler';
import { isTopFrameRequest, toNavigationRequest } from '../src/webview/topFrame';

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

  // react-native-webview 14 leaves the flag out of every Android request, debug or release.
  it('reads a missing flag on Android as the page itself', () => {
    expect(isTopFrameRequest({}, 'android')).toBe(true);
  });

  it('reads a missing flag anywhere else as a frame', () => {
    expect(isTopFrameRequest({}, 'ios')).toBe(false);
    expect(isTopFrameRequest({}, 'web')).toBe(false);
  });
});

describe('toNavigationRequest', () => {
  it('keeps the URL and reads the flag through isTopFrameRequest', () => {
    const request: WebViewRequest = { url: PAID_RETURN };

    expect(toNavigationRequest(request, 'android')).toEqual({ url: PAID_RETURN, isTopFrame: true });
    expect(toNavigationRequest(request, 'ios')).toEqual({ url: PAID_RETURN, isTopFrame: false });
    expect(toNavigationRequest({ url: PAID_RETURN, isTopFrame: false }, 'android')).toEqual({
      url: PAID_RETURN,
      isTopFrame: false,
    });
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

    expect(handler(toNavigationRequest({ url: PAID_RETURN }, 'android'))).toBe(false);
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

    expect(handler(toNavigationRequest({ url: PAID_RETURN }, 'ios'))).toBe(false);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
