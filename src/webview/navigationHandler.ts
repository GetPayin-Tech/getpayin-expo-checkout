import { classifyNavigation } from '../core/navigation';
import { resolveReturn } from '../core/returnUrl';
import type { CheckoutResult } from '../types';

/**
 * One navigation request, as `react-native-webview` reports it to
 * `onShouldStartLoadWithRequest`.
 *
 * `isTopFrame` has no default on purpose. It decides whether a frame inside the checkout
 * page can end the checkout, and a value guessed here would be guessed in favour of the
 * page.
 */
export interface NavigationRequest {
  readonly url: string;
  readonly isTopFrame: boolean;
}

/** What a navigation handler needs in order to act on a navigation request. */
export interface NavigationHandlerOptions {
  readonly returnUrl: string;
  readonly expectedInvoiceId?: string | number;

  /**
   * Every other scheme the host app answers to; refused like the return link's scheme.
   * Build it with `hostAppSchemes()`, which reads them from the app config.
   */
  readonly ownSchemes: readonly string[];

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
): (request: NavigationRequest) => boolean {
  let completed = false;

  return (request: NavigationRequest): boolean => {
    const decision = classifyNavigation(request.url, {
      returnUrl: options.returnUrl,
      ownSchemes: options.ownSchemes,
      isTopFrame: request.isTopFrame,
    });

    if (decision === 'return') {
      if (!completed) {
        completed = true;
        options.onComplete(
          resolveReturn(request.url, {
            ...(options.expectedInvoiceId === undefined
              ? {}
              : { expectedInvoiceId: options.expectedInvoiceId }),
          }),
        );
      }

      return false;
    }

    if (decision === 'external') {
      options.onExternal(request.url);

      return false;
    }

    return decision === 'load';
  };
}
