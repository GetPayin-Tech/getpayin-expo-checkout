import type { CheckoutResult, ReturnUrlParams, StatusResolver } from '../types';
import { CheckoutStatus } from '../types';
import { isSameTarget, normalizeToken, parseQuery, parseUrl } from './url';

const STATUS_KEYS = ['status', 'paymentstatus', 'paidstatus', 'result', 'state'] as const;
const SUCCESS_KEYS = ['success', 'paid', 'ispaid'] as const;
const INVOICE_KEYS = ['invoiceid', 'invoice', 'invoicenumber', 'invoiceno', 'id'] as const;
const MESSAGE_KEYS = [
  'message',
  'statusmessage',
  'errormessage',
  'error',
  'reason',
  'description',
] as const;

const PAID_TOKENS = new Set([
  'paid',
  'success',
  'successful',
  'succeeded',
  'completed',
  'complete',
  'authorized',
  'authorised',
  'approved',
  'true',
  '1',
  'yes',
]);

const NOT_PAID_TOKENS = new Set([
  'notpaid',
  'unpaid',
  'failed',
  'failure',
  'fail',
  'declined',
  'decline',
  'rejected',
  'error',
  'false',
  '0',
  'no',
]);

const CANCELLED_TOKENS = new Set([
  'cancelled',
  'canceled',
  'cancel',
  'aborted',
  'abort',
  'dismissed',
  'usercancelled',
  'usercanceled',
]);

const UNREADABLE_MESSAGE =
  'The checkout returned without a status this package recognises. Confirm the invoice on ' +
  'your server before you treat it as paid.';

/** True when `url` is the return link the checkout was opened with. */
export function matchesReturnUrl(url: string, returnUrl: string): boolean {
  return isSameTarget(url, returnUrl);
}

/** Reads the first of `keys` that is present and not blank. */
function firstValue(params: ReturnUrlParams, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = params[key];

    if (value !== undefined && value.trim() !== '') {
      return value.trim();
    }
  }

  return undefined;
}

/** Maps a reported status or success flag onto one of the three outcomes. */
function classifyToken(value: string): CheckoutResult['status'] | undefined {
  const token = normalizeToken(value);

  if (PAID_TOKENS.has(token)) {
    return CheckoutStatus.Paid;
  }

  if (NOT_PAID_TOKENS.has(token)) {
    return CheckoutStatus.NotPaid;
  }

  if (CANCELLED_TOKENS.has(token)) {
    return CheckoutStatus.Cancelled;
  }

  return undefined;
}

/** Picks the outcome out of the parameters, preferring an explicit status parameter. */
function readStatus(params: ReturnUrlParams): CheckoutResult['status'] | undefined {
  const reported = firstValue(params, STATUS_KEYS);

  if (reported !== undefined) {
    const classified = classifyToken(reported);

    if (classified !== undefined) {
      return classified;
    }
  }

  const flag = firstValue(params, SUCCESS_KEYS);

  return flag === undefined ? undefined : classifyToken(flag);
}

/**
 * Turns a return link into a result.
 *
 * A link whose status cannot be read becomes `not_paid` with an explanatory message,
 * never `paid`: the app is not allowed to decide that a payment succeeded, and the
 * `invoice.paid` webhook on your server is what settles it either way.
 */
export function readCheckoutResult(url: string, statusResolver?: StatusResolver): CheckoutResult {
  const parsed = parseUrl(url);
  const params = parseQuery(parsed?.query ?? '');
  const resolved = statusResolver?.(params, url);

  if (resolved !== undefined) {
    return { ...resolved, returnUrl: url };
  }

  const status = readStatus(params);
  const invoiceId = firstValue(params, INVOICE_KEYS);
  const message =
    firstValue(params, MESSAGE_KEYS) ?? (status === undefined ? UNREADABLE_MESSAGE : undefined);

  return {
    status: status ?? CheckoutStatus.NotPaid,
    ...(invoiceId === undefined ? {} : { invoiceId }),
    ...(message === undefined ? {} : { message }),
    returnUrl: url,
  };
}

/** What {@link resolveReturn} needs in order to turn a link into a result. */
export interface ReturnResolution {
  readonly statusResolver?: StatusResolver;
  readonly expectedInvoiceId?: string;
}

const WRONG_INVOICE_MESSAGE =
  'The return link named a different invoice from the one this checkout was opened for, ' +
  "so it is not this checkout's result.";

/**
 * Refuses a `paid` that does not belong to the invoice the checkout was opened for.
 *
 * Only `paid` is downgraded. A `not_paid` or `cancelled` carries no claim worth checking,
 * and rewriting it would lose the reason the payer was given.
 */
function bindToInvoice(result: CheckoutResult, expectedInvoiceId?: string): CheckoutResult {
  if (expectedInvoiceId === undefined || result.status !== CheckoutStatus.Paid) {
    return result;
  }

  if (result.invoiceId === expectedInvoiceId) {
    return result;
  }

  return { ...result, status: CheckoutStatus.NotPaid, message: WRONG_INVOICE_MESSAGE };
}

/**
 * Turns a return link into a result, bound to the checkout it was opened for.
 *
 * Both presentations go through this, so the in-app screen and the browser sheet cannot
 * drift apart on what a given link means.
 */
export function resolveReturn(url: string, options: ReturnResolution): CheckoutResult {
  return bindToInvoice(readCheckoutResult(url, options.statusResolver), options.expectedInvoiceId);
}

/** The result for a payer who closed the checkout without finishing. */
export function cancelledResult(message?: string): CheckoutResult {
  return {
    status: CheckoutStatus.Cancelled,
    ...(message === undefined ? {} : { message }),
  };
}
