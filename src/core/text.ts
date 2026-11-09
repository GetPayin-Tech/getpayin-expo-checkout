/**
 * The caller's text, or `fallback` when there is none worth showing.
 *
 * Blank text counts as absent rather than being kept. `closeLabel: t('checkout.close')`
 * with a translation key that is missing yields `''`, and `?? fallback` would keep it — a
 * close button with no label and nothing for a screen reader to announce, on a full-screen
 * modal that has no hardware back button on iOS. That is the payer's only way out of the
 * checkout, so an empty label would leave `open()` pending and the session guard busy for
 * the rest of the process.
 */
export function fallbackText(value: string | undefined, fallback: string): string {
  return value === undefined || value.trim() === '' ? fallback : value;
}
