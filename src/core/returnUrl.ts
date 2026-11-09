import type { CheckoutResult } from '../types';
import { CheckoutResultCode, CheckoutStatus } from '../types';
import { invoiceIdFrom, normalizeInvoiceId } from './invoiceId';
import {
  decodeQueryComponent,
  isSameTarget,
  normalizeToken,
  parseUrl,
  rawQueryNames,
  readQuery,
} from './url';

/*
 * The fields of GetPayIn's return link, as the backend's app-return bridge builds it:
 *
 *   myapp://payment-return?success=1&invoice_id=4512&invoice_status=PAID&message=…&signature=…
 *
 * `success` is `1` or `0`. Only `success`, `invoice_id`, `invoice_status` and `message` are
 * read. A reader that also accepted other names (`status`, `state`, `result`, …) would let
 * a field the backend adds later decide the outcome without anyone noticing.
 *
 * The names must match exactly and the values are taken as sent. A link that repeats any
 * field, or that carries a name only a looser reader would take for one of these four —
 * `Success`, `invoiceId`, `%73uccess` — is unreadable. That keeps this reader and a server
 * that checks the link's `signature` from ever reading different values out of the same
 * link: a looser reader (any case, first copy wins) could report invoice B as paid from a
 * link whose signature is genuine for invoice A. None of this stops a forged link from
 * saying `success=1`; that is what the `invoice.paid` webhook on the server is for.
 */
const SUCCESS_KEY = 'success';
const INVOICE_KEY = 'invoice_id';
const INVOICE_STATUS_KEY = 'invoice_status';
const MESSAGE_KEY = 'message';
const READ_KEYS = new Set([SUCCESS_KEY, INVOICE_KEY, INVOICE_STATUS_KEY, MESSAGE_KEY]);

/**
 * The read keys with case and separators collapsed, for spotting a name that is not one of
 * them but that another reader of the same link could take for one.
 */
const READ_TOKENS = new Set([...READ_KEYS].map((key) => normalizeToken(key)));

/**
 * The one `invoice_status` that means the invoice is settled in full.
 *
 * `UNPAID`, `PARTIALLY_PAID` and `AUTHORIZED` are not orders to fulfil, so a link carrying
 * one of them is reported as `not_paid` however its `success` flag reads.
 */
const PAID_INVOICE_STATUSES = new Set(['paid']);

const UNREADABLE_MESSAGE =
  'The checkout returned without a status this package recognises. Confirm the invoice on ' +
  'your server before you treat it as paid.';

const WRONG_INVOICE_MESSAGE =
  'The return link named a different invoice from the one this checkout was opened for, ' +
  "so it is not this checkout's result.";

const UNEXPECTED_STATUS_MESSAGE =
  'The checkout reported the invoice as something other than paid in full. Confirm it on ' +
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

/** The link's own message, with blank text treated as no message at all. */
function readMessage(params: ReadonlyMap<string, readonly string[]>): string | undefined {
  const value = readField(params, MESSAGE_KEY);

  return value === undefined || value.trim() === '' ? undefined : value;
}

/**
 * True when the link repeats any field.
 *
 * Every field, not only the four that are read: a repeated `signature` is how a server
 * that checks it and this reader could be made to disagree about which copy of the link
 * they are looking at.
 */
function repeatsAField(params: ReadonlyMap<string, readonly string[]>): boolean {
  return [...params.values()].some((values) => values.length > 1);
}

/**
 * True when a field name is not one of the four read, yet collapses onto one of them.
 *
 * `Success`, `INVOICE_ID`, `invoiceId` and `%73uccess` all reach a reader that folds case,
 * ignores separators or decodes names before matching. A server verifying the signature
 * over the raw query string would not see them as those fields, so the link is refused
 * rather than read one way here and another way there.
 */
function hasAmbiguousName(names: readonly string[]): boolean {
  return names.some(
    (name) =>
      !READ_KEYS.has(name) &&
      (READ_TOKENS.has(normalizeToken(name)) ||
        READ_TOKENS.has(normalizeToken(decodeQueryComponent(name)))),
  );
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
 * The result for a link whose own fields could not be read.
 *
 * The link's own `message` is dropped rather than shown. GetPayIn's bridge always sends
 * one, so keeping it would make this indistinguishable from a genuine decline — and a link
 * reading `success=true&message=Payment+completed` would tell the payer the payment
 * succeeded while the app was told it had not. `code` is what an app branches on.
 */
function unreadableResult(url: string): CheckoutResult {
  return {
    status: CheckoutStatus.NotPaid,
    code: CheckoutResultCode.UnreadableReturnLink,
    message: UNREADABLE_MESSAGE,
    returnUrl: url,
  };
}

/**
 * Refuses a `paid` whose `invoice_status` is not `PAID`.
 *
 * Only a downgrade, never an upgrade: a `success=0` carrying `invoice_status=PAID` stays
 * `not_paid`. A link with no `invoice_status` at all is left as it was, so a backend that
 * stops sending the field does not turn every payment into a failure.
 */
function bindToInvoiceStatus(result: CheckoutResult): CheckoutResult {
  if (result.status !== CheckoutStatus.Paid || result.invoiceStatus === undefined) {
    return result;
  }

  if (PAID_INVOICE_STATUSES.has(normalizeToken(result.invoiceStatus))) {
    return result;
  }

  return {
    ...result,
    status: CheckoutStatus.NotPaid,
    code: CheckoutResultCode.UnexpectedInvoiceStatus,
    message: UNEXPECTED_STATUS_MESSAGE,
  };
}

/**
 * Turns a return link into a result.
 *
 * A link whose status cannot be read becomes `not_paid` with an explanatory message and
 * `unreadable_return_link`, never `paid`: the app is not allowed to decide that a payment
 * succeeded, and the `invoice.paid` webhook on your server is what settles it either way.
 */
export function readCheckoutResult(url: string): CheckoutResult {
  const query = parseUrl(url)?.query ?? '';
  const params = readQuery(query);

  if (repeatsAField(params) || hasAmbiguousName(rawQueryNames(query))) {
    return unreadableResult(url);
  }

  const status = readStatus(readField(params, SUCCESS_KEY));

  if (status === undefined) {
    return unreadableResult(url);
  }

  const invoiceId = readField(params, INVOICE_KEY);
  const invoiceStatus = readField(params, INVOICE_STATUS_KEY);
  const message = readMessage(params);

  return bindToInvoiceStatus({
    status,
    ...(invoiceId === undefined ? {} : { invoiceId }),
    ...(invoiceStatus === undefined ? {} : { invoiceStatus }),
    ...(message === undefined ? {} : { message }),
    returnUrl: url,
  });
}

/** What {@link resolveReturn} needs in order to turn a link into a result. */
export interface ReturnResolution {
  readonly expectedInvoiceId?: string | number;
}

/**
 * Refuses a `paid` that does not belong to the invoice the checkout was opened for.
 *
 * Only `paid` is downgraded. A `not_paid` or `cancelled` carries no claim worth checking,
 * and rewriting it would lose the reason the payer was given.
 *
 * Both sides go through `invoiceIdFrom` and `normalizeInvoiceId`, so a number from the
 * server and the text in the link are compared in one form. Only `undefined` means no
 * invoice to bind to; anything the validator would refuse — `null`, `''`, `NaN`, a number
 * past `Number.MAX_SAFE_INTEGER`, an object — binds to nothing, so a `paid` is refused.
 * `open()` and the view reject those values up front (`assertExpectedInvoiceId`); this is
 * the fail-closed backstop for callers of the lower-level exports, and it refuses exactly
 * what the validator refuses.
 */
function bindToInvoice(
  result: CheckoutResult,
  expectedInvoiceId?: string | number,
): CheckoutResult {
  if (expectedInvoiceId === undefined || result.status !== CheckoutStatus.Paid) {
    return result;
  }

  const expected = invoiceIdFrom(expectedInvoiceId);
  const reported =
    result.invoiceId === undefined ? undefined : normalizeInvoiceId(result.invoiceId);

  if (expected !== undefined && reported === expected) {
    return result;
  }

  return {
    ...result,
    status: CheckoutStatus.NotPaid,
    code: CheckoutResultCode.WrongInvoice,
    message: WRONG_INVOICE_MESSAGE,
  };
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
