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

/**
 * Checks the invoice id a checkout is bound to.
 *
 * Only `undefined` means "no invoice to bind to". Anything else that is not non-blank text
 * or a finite number is refused — `null`, `''`, `NaN`, `true`, an object such as the whole
 * init response — because taking it as "not given" would quietly accept a genuine paid link
 * for any other invoice, and comparing against it would report every real payment as not
 * paid. A setup error shows the mistake while the app is being built instead.
 *
 * A field missing from the server's JSON arrives as `undefined` and cannot be told apart
 * from leaving the option out, so it is not caught here.
 */
export function assertExpectedInvoiceId(expectedInvoiceId: unknown): string | number | undefined {
  if (expectedInvoiceId === undefined) {
    return undefined;
  }

  if (typeof expectedInvoiceId === 'number' && Number.isFinite(expectedInvoiceId)) {
    return expectedInvoiceId;
  }

  if (typeof expectedInvoiceId === 'string' && expectedInvoiceId.trim() !== '') {
    return expectedInvoiceId;
  }

  throw new GetPayInConfigError(
    'expectedInvoiceId must be the invoice_id your server received from init; ' +
      `received ${describeValue(expectedInvoiceId)}. Leave it out only if you have no ` +
      'invoice id at all.',
  );
}

/** Names a bad value for an error message without serialising it (it may be circular). */
function describeValue(value: unknown): string {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return Array.isArray(value) ? 'an array' : `a value of type ${typeof value}`;
}
