import { describe, expect, it } from 'vitest';

import { fallbackText } from '../src/core/text';

describe('fallbackText', () => {
  it('keeps the text the app gave', () => {
    expect(fallbackText('إغلاق', 'Close')).toBe('إغلاق');
  });

  /*
   * `t('checkout.close')` with a missing translation key returns ''. `?? fallback` would
   * keep it, leaving the payer a close button with no label — and on a full-screen modal
   * with no hardware back button, no way out of the checkout at all.
   */
  it.each([
    ['nothing', undefined],
    ['an empty string', ''],
    ['a blank string', '   '],
  ])('falls back on %s', (_label, value) => {
    expect(fallbackText(value, 'Close')).toBe('Close');
  });
});
