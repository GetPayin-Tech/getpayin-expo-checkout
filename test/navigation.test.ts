import { describe, expect, it } from 'vitest';

import { classifyNavigation } from '../src/core/navigation';

const RETURN_URL = 'myapp://payment-return';

describe('classifyNavigation', () => {
  it('ends the checkout on the return link', () => {
    expect(classifyNavigation('myapp://payment-return?status=paid', RETURN_URL)).toBe('return');
  });

  it.each([
    'https://pay.getpayin.com/checkout/abc',
    'http://pay.getpayin.com/checkout/abc',
    'about:blank',
  ])('keeps %s in the web view', (url) => {
    expect(classifyNavigation(url, RETURN_URL)).toBe('load');
  });

  it.each([
    'mybank://authorise/3ds/123',
    'tel:+96512345678',
    'mailto:support@example.com',
    'intent://scan#Intent;scheme=zxing;end',
  ])('hands %s to the phone', (url) => {
    expect(classifyNavigation(url, RETURN_URL)).toBe('external');
  });

  it.each(['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'vbscript:msgbox(1)'])(
    'refuses %s outright rather than handing it to the phone',
    (url) => {
      expect(classifyNavigation(url, RETURN_URL)).toBe('block');
    },
  );

  it.each([
    'myapp://account/delete?confirm=1',
    'myapp://settings',
    'MYAPP://payment-return/elsewhere',
  ])("refuses %s, so a page cannot drive the host app's own deep links", (url) => {
    expect(classifyNavigation(url, RETURN_URL)).toBe('block');
  });

  it('still hands a different app its own scheme', () => {
    expect(classifyNavigation('mybank://authorise/3ds/1', RETURN_URL)).toBe('external');
  });

  it('keeps a relative navigation in the web view', () => {
    expect(classifyNavigation('/checkout/step-2', RETURN_URL)).toBe('load');
  });
});
