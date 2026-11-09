import type { CheckoutResult } from '../types';
import { CheckoutStatus } from '../types';
import { isSameTarget, parseUrl, readQuery } from './url';

/*
 * The fields of GetPayIn's return link, as the backend's app-return bridge builds it:
 *
 *   myapp://payment-return?success=1&invoice_id=4512&invoice_status=PAID&message=…&signature=…
 *
 * `success` is `1` or `0`. Only `success`, `invoice_id` and `message` are read. A reader
 * that also accepted other names (`status`, `state`, `result`, …) would let a field the
 * backend adds later decide the outcome without anyone noticing.
 *
 * The names must match exactly and the values are taken as sent, and a link that repeats
 * any of the three is unreadable. That keeps this reader and a server that checks the
 * link's `signature` from ever reading different values out of the same link: a looser
 * reader (any case, first copy wins) could report invoice B as paid from a link whose
 * signature is genuine for invoice A. None of this stops a forged link from saying
 * `success=1`; that is what the `invoice.paid` webhook on the server is for.
 */
const SUCCESS_KEY = 'success';
const INVOICE_KEY = 'invoice_id';
const MESSAGE_KEY = 'message';
const READ_KEYS = [SUCCESS_KEY, INVOICE_KEY, MESSAGE_KEY] as const;

const UNREADABLE_MESSAGE =
  'The checkout returned without a status this package recognises. Confirm the invoice on ' +
  'your server before you treat it as paid.';

/** True when `url` is the return link the checkout was opened with. */
export function matchesReturnUrl(url: string, returnUrl: string): boolean {
  return isSameTarget(url, returnUrl);
}

/** The single value of `key`, or `undefined` when it is absent or empty. */
function readField(
  params: ReadonlyMap<string, readonly string[]>,
  key: string,
): string | undefined {
  const value = params.get(key)?.[0];

  return value === undefined || value === '' ? undefined : value;
}

/** True when any field this reader uses appears more than once. */
function repeatsAField(params: ReadonlyMap<string, readonly string[]>): boolean {
  return READ_KEYS.some((key) => (params.get(key)?.length ?? 0) > 1);
}

/** Maps GetPayIn's `success` flag onto an outcome; anything but `1` or `0` is unreadable. */
function readStatus(success: string | undefined): CheckoutResult['status'] | undefined {
  if (success === '1') {
    return CheckoutStatus.Paid;
  }

  if (success === '0') {
    return CheckoutStatus.NotPaid;
  }

  return undefined;
}

/**
 * Turns a return link into a result.
 *
 * A link whose status cannot be read becomes `not_paid` with an explanatory message,
 * never `paid`: the app is not allowed to decide that a payment succeeded, and the
 * `invoice.paid` webhook on your server is what settles it either way.
 */
export function readCheckoutResult(url: string): CheckoutResult {
  const params = readQuery(parseUrl(url)?.query ?? '');

  if (repeatsAField(params)) {
    return { status: CheckoutStatus.NotPaid, message: UNREADABLE_MESSAGE, returnUrl: url };
  }

  const status = readStatus(readField(params, SUCCESS_KEY));
  const invoiceId = readField(params, INVOICE_KEY);
  const message =
    readField(params, MESSAGE_KEY) ?? (status === undefined ? UNREADABLE_MESSAGE : undefined);

  return {
    status: status ?? CheckoutStatus.NotPaid,
    ...(invoiceId === undefined ? {} : { invoiceId }),
    ...(message === undefined ? {} : { message }),
    returnUrl: url,
  };
}

/** What {@link resolveReturn} needs in order to turn a link into a result. */
export interface ReturnResolution {
  readonly expectedInvoiceId?: string | number;
}

const WRONG_INVOICE_MESSAGE =
  'The return link named a different invoice from the one this checkout was opened for, ' +
  "so it is not this checkout's result.";

/**
 * Refuses a `paid` that does not belong to the invoice the checkout was opened for.
 *
 * Only `paid` is downgraded. A `not_paid` or `cancelled` carries no claim worth checking,
 * and rewriting it would lose the reason the payer was given.
 *
 * The comparison is on trimmed text. GetPayIn hands the invoice id to the server as a
 * number and puts it in the return link as text, so comparing the values as they arrive
 * would turn every paid checkout into `not_paid`. Only `undefined` means no invoice to bind
 * to; an empty value or `null` from untyped code binds to nothing, so a `paid` is refused.
 * `open()` and the view reject those values up front (`assertExpectedInvoiceId`); this is
 * the fail-closed backstop for callers of the lower-level exports.
 */
function bindToInvoice(
  result: CheckoutResult,
  expectedInvoiceId?: string | number,
): CheckoutResult {
  if (expectedInvoiceId === undefined || result.status !== CheckoutStatus.Paid) {
    return result;
  }

  const expected = String(expectedInvoiceId ?? '').trim();

  if (expected !== '' && result.invoiceId === expected) {
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
  return bindToInvoice(readCheckoutResult(url), options.expectedInvoiceId);
}

/** The result for a payer who closed the checkout without finishing. */
export function cancelledResult(message?: string): CheckoutResult {
  return {
    status: CheckoutStatus.Cancelled,
    ...(message === undefined ? {} : { message }),
  };
}
