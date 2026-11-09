import { assertCheckoutUrl, assertExpectedInvoiceId, assertReturnUrl } from '../core/validate';
import { GetPayInCheckoutError } from '../errors';

/** What the checkout view loads, or why it cannot. */
export interface CheckoutSource {
  readonly uri: string;
  readonly returnUrl: string;

  /** The invoice id as it will be compared, already validated and normalised. */
  readonly expectedInvoiceId?: string;

  /**
   * Why the checkout cannot load, for the developer.
   *
   * It names the option and the value it got, so it belongs in a log and never on a
   * payment screen: the payer is shown `loadErrorMessage` instead, in the app's language.
   */
  readonly error?: string;
}

/**
 * Validates the checkout view's props once per checkout, as a value rather than as a
 * thrown error.
 *
 * An unusable `checkoutUrl`, `returnUrl` or `expectedInvoiceId` gives `about:blank` and an
 * `error` the view reports through `onLoadError`. They arrive from a server at runtime, and
 * a bad one should not take the screen down with it.
 *
 * The normalised invoice id is handed back, so the value the navigation handler compares
 * against is the one that was validated rather than the raw prop.
 */
export function buildCheckoutSource(
  checkoutUrl: string,
  returnUrl: string,
  expectedInvoiceId: unknown,
): CheckoutSource {
  try {
    const invoiceId = assertExpectedInvoiceId(expectedInvoiceId);

    return {
      uri: assertCheckoutUrl(checkoutUrl),
      returnUrl: assertReturnUrl(returnUrl),
      ...(invoiceId === undefined ? {} : { expectedInvoiceId: invoiceId }),
    };
  } catch (cause) {
    const error = cause instanceof GetPayInCheckoutError ? cause.message : String(cause);

    return { uri: 'about:blank', returnUrl, error };
  }
}
