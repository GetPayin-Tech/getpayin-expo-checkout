import { classifyNavigation } from '../core/navigation';
import { resolveReturn } from '../core/returnUrl';
import type { CheckoutResult, StatusResolver } from '../types';

/** What a navigation handler needs in order to act on a navigation request. */
export interface NavigationHandlerOptions {
  readonly returnUrl: string;
  readonly statusResolver?: StatusResolver;
  readonly expectedInvoiceId?: string;
  readonly onComplete: (result: CheckoutResult) => void;
  readonly onExternal: (url: string) => void;
}

/**
 * Builds the decision half of the checkout web view, with no React and no native module
 * behind it.
 *
 * The returned function answers the web view's `onShouldStartLoadWithRequest`: `false`
 * stops the navigation, either because something other than the web view is handling it
 * or because it was refused, and `true` lets the checkout carry on loading.
 *
 * Each handler completes at most once. The return link can reach a live web view more
 * than once — a redirect followed by the payer's own back navigation, for instance — and a
 * second result for one checkout would be reported as a second payment.
 */
export function createNavigationHandler(
  options: NavigationHandlerOptions,
): (url: string) => boolean {
  let completed = false;

  return (url: string): boolean => {
    const decision = classifyNavigation(url, options.returnUrl);

    if (decision === 'return') {
      if (!completed) {
        completed = true;
        options.onComplete(
          resolveReturn(url, {
            ...(options.statusResolver === undefined
              ? {}
              : { statusResolver: options.statusResolver }),
            ...(options.expectedInvoiceId === undefined
              ? {}
              : { expectedInvoiceId: options.expectedInvoiceId }),
          }),
        );
      }

      return false;
    }

    if (decision === 'external') {
      options.onExternal(url);

      return false;
    }

    return decision === 'load';
  };
}
