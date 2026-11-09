import { GetPayInConfigError } from '../errors';
import { parseUrl } from './url';

/**
 * Checks the checkout URL before anything is drawn, and hands back the trimmed value.
 *
 * The trimmed value is what is returned because it is what was validated. The native side
 * does not trim, so a stray leading space would pass a check made on the trimmed string
 * and then fail inside the web view or the browser sheet, where the cause is invisible.
 *
 * The usual cause of a bad value here is passing `checkout_url` through a navigation
 * parameter, which decodes it a second time and breaks the link's signature. Keep it in
 * memory and hand it straight to the package.
 */
export function assertCheckoutUrl(checkoutUrl: string): string {
  const trimmed = checkoutUrl.trim();
  const parsed = parseUrl(trimmed);

  if (!parsed || (parsed.scheme !== 'https' && parsed.scheme !== 'http')) {
    throw new GetPayInConfigError(
      `checkoutUrl must be an http(s) URL from your server; received "${checkoutUrl}".`,
    );
  }

  return trimmed;
}

/** Checks the return link the checkout is expected to come back to. */
export function assertReturnUrl(returnUrl: string): string {
  const trimmed = returnUrl.trim();
  const parsed = parseUrl(trimmed);

  if (!parsed || parsed.scheme === '') {
    throw new GetPayInConfigError(
      `returnUrl must start with your app's scheme, for example "myapp://payment-return"; ` +
        `received "${returnUrl}".`,
    );
  }

  return trimmed;
}
