/*
 * One form for the invoice id, used by everything that compares two of them.
 *
 * The id reaches this package from two places that disagree about its type: `POST
 * /api/integration/init` and the `@getpayin/getpayin` server SDK report it as a JSON
 * number, while the return link carries it as text. Reducing both sides here is what keeps
 * a paid checkout from being reported as `not_paid` — and keeps the rule in one place, so
 * the validator that refuses a bad value up front and the backstop inside `resolveReturn`
 * cannot drift apart on what counts as the same invoice.
 */

/** Digits only, which is the shape GetPayIn's own invoice ids have. */
const DIGITS_ONLY = /^\d+$/;

/** Leading zeros on a digits-only id, which carry no meaning. */
const LEADING_ZEROS = /^0+(?=\d)/;

/**
 * Reduces one invoice id to the form the two sides are compared in.
 *
 * Trimmed, because the link side arrives percent-decoded and `+` decodes to a space, so a
 * stray `invoice_id=+4512` would otherwise never match the `4512` the server reported.
 * Leading zeros are dropped from a digits-only id for the same reason: it is the same
 * invoice written two ways, and refusing it would tell a payer who has paid to pay again.
 */
export function normalizeInvoiceId(value: string): string {
  const trimmed = value.trim();

  return DIGITS_ONLY.test(trimmed) ? trimmed.replace(LEADING_ZEROS, '') : trimmed;
}

/**
 * The invoice id a value can be bound to, or `undefined` when it cannot be one.
 *
 * Text must be non-blank. A number must be a safe integer: a non-integer is not an invoice
 * id, and a number past `Number.MAX_SAFE_INTEGER` has already lost digits by the time it
 * gets here, so comparing it would report a real payment as `not_paid` for a reason
 * invisible from the call site. `null`, `NaN`, `true` and an object — the whole init
 * response passed by untyped code — are all refused.
 */
export function invoiceIdFrom(value: unknown): string | undefined {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? normalizeInvoiceId(String(value)) : undefined;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    return normalizeInvoiceId(value);
  }

  return undefined;
}
