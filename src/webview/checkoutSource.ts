import { assertCheckoutUrl, assertExpectedInvoiceId, assertReturnUrl } from '../core/validate';
import { GetPayInCheckoutError } from '../errors';

/** What the checkout view loads, or why it cannot. */
export interface CheckoutSource {
  readonly uri: string;
  readonly returnUrl: string;
  readonly error?: string;
}

/**
 * Validates the checkout view's props once per checkout, as a value rather than as a
 * thrown error.
 *
 * An unusable `checkoutUrl`, `returnUrl` or `expectedInvoiceId` gives `about:blank` and an
 * `error` the view reports through `onLoadError`. They arrive from a server at runtime, and
 * a bad one should not take the screen down with it.
 */
export function buildCheckoutSource(
  checkoutUrl: string,
  returnUrl: string,
  expectedInvoiceId: unknown,
): CheckoutSource {
  try {
    assertExpectedInvoiceId(expectedInvoiceId);

    return { uri: assertCheckoutUrl(checkoutUrl), returnUrl: assertReturnUrl(returnUrl) };
  } catch (cause) {
    const error = cause instanceof GetPayInCheckoutError ? cause.message : String(cause);

    return { uri: 'about:blank', returnUrl, error };
  }
}
