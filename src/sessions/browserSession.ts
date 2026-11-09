import * as WebBrowser from 'expo-web-browser';

import { createDeferred } from '../core/deferred';
import { cancelledResult, matchesReturnUrl, resolveReturn } from '../core/returnUrl';
import type { ReturnResolution } from '../core/returnUrl';
import type { CheckoutRequest, CheckoutResult } from '../types';
import { watchForReturnUrl } from './deepLink';

/**
 * How long a dismissed browser sheet waits for the return link before it is reported as
 * cancelled. On Android the sheet can report its own dismissal before the deep link it
 * was dismissed by reaches the app, and settling on that order would report a payment
 * the payer actually completed as cancelled.
 */
const DEEP_LINK_GRACE_MS = 600;

/**
 * Runs `work` and swallows any failure, for a call whose outcome changes nothing.
 *
 * Only one of the dismiss calls applies on a given platform and the other rejects, which
 * is not a problem worth surfacing to the payer.
 */
async function ignoreFailure(work: () => unknown): Promise<void> {
  try {
    await work();
  } catch {
    return;
  }
}

/** Closes the browser sheet, whichever kind of session the platform opened. */
async function closeBrowser(): Promise<void> {
  await ignoreFailure(() => WebBrowser.dismissAuthSession?.());
  await ignoreFailure(() => WebBrowser.dismissBrowser?.());
}

/** Resolves once `promise` settles or the grace period runs out, whichever is first. */
function withGrace(promise: Promise<CheckoutResult>): Promise<CheckoutResult | undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), DEEP_LINK_GRACE_MS);

    void promise.then((result) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
}

/**
 * Opens the checkout in the phone's browser sheet and waits for the result.
 *
 * This is the Android path until Google has approved the client's app: Google Pay runs in
 * a real browser without any approval, where in an app's own web view it does not.
 */
export async function runBrowserCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
  const { checkoutUrl, options } = request;
  const resolution: ReturnResolution = {
    ...(options.statusResolver === undefined ? {} : { statusResolver: options.statusResolver }),
    ...(options.expectedInvoiceId === undefined
      ? {}
      : { expectedInvoiceId: options.expectedInvoiceId }),
  };
  const deferred = createDeferred<CheckoutResult>();
  const watcher = watchForReturnUrl(options.returnUrl, (url) => {
    deferred.resolve(resolveReturn(url, resolution));
  });

  try {
    const session = await WebBrowser.openAuthSessionAsync(checkoutUrl, options.returnUrl);

    if (
      session.type === 'success' &&
      typeof session.url === 'string' &&
      matchesReturnUrl(session.url, options.returnUrl)
    ) {
      deferred.resolve(resolveReturn(session.url, resolution));
    }

    if (deferred.settled()) {
      return await deferred.promise;
    }

    const late = await withGrace(deferred.promise);

    return late ?? cancelledResult('The payer closed the checkout.');
  } finally {
    watcher.stop();
    await closeBrowser();
  }
}
