import { describe, expect, it } from 'vitest';

import { classifyNavigation } from '../src/core/navigation';
import type { NavigationContext } from '../src/core/navigation';

const RETURN_URL = 'myapp://payment-return';

/** The ordinary case: the page itself navigating, in an app with no extra schemes. */
function topFrame(ownSchemes: readonly string[] = []): NavigationContext {
  return { returnUrl: RETURN_URL, ownSchemes, isTopFrame: true };
}

/** A frame inside the checkout page navigating. */
function subFrame(ownSchemes: readonly string[] = []): NavigationContext {
  return { returnUrl: RETURN_URL, ownSchemes, isTopFrame: false };
}

describe('classifyNavigation', () => {
  it('ends the checkout on the return link', () => {
    expect(classifyNavigation('myapp://payment-return?success=1', topFrame())).toBe('return');
  });

  it.each([
    'https://pay.getpayin.com/checkout/abc',
    'http://pay.getpayin.com/checkout/abc',
    'about:blank',
  ])('keeps %s in the web view', (url) => {
    expect(classifyNavigation(url, topFrame())).toBe('load');
  });

  it.each([
    'mybank://authorise/3ds/123',
    'tel:+96512345678',
    'mailto:support@example.com',
    'intent://scan#Intent;scheme=zxing;end',
  ])('hands %s to the phone', (url) => {
    expect(classifyNavigation(url, topFrame())).toBe('external');
  });

  it.each(['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'vbscript:msgbox(1)'])(
    'refuses %s outright rather than handing it to the phone',
    (url) => {
      expect(classifyNavigation(url, topFrame())).toBe('block');
    },
  );

  it.each([
    'market://details?id=evil.app',
    'itms-apps://apps.apple.com/app/id1',
    'itms-services://?action=download-manifest',
    'sms:+15550100?body=TRANSFER%20500',
    'smsto:+15550100',
    'mms:+15550100',
    'shortcuts://run-shortcut?name=Pay',
    'content://com.android.providers/contacts',
    'android-app://com.other.app',
  ])('refuses %s, which has no part in paying for anything', (url) => {
    expect(classifyNavigation(url, topFrame())).toBe('block');
  });

  it.each([
    'myapp://account/delete?confirm=1',
    'myapp://settings',
    'MYAPP://payment-return/elsewhere',
  ])("refuses %s, so a page cannot drive the host app's own deep links", (url) => {
    expect(classifyNavigation(url, topFrame())).toBe('block');
  });

  it.each(['com.shop.app://orders/1/cancel', 'COM.SHOP.APP://settings', 'myapp-ios://account'])(
    'refuses %s, another scheme the host app answers to',
    (url) => {
      expect(classifyNavigation(url, topFrame(['com.shop.app', 'MyApp-iOS']))).toBe('block');
    },
  );

  it('still hands a different app its own scheme', () => {
    expect(classifyNavigation('mybank://authorise/3ds/1', topFrame())).toBe('external');
    expect(classifyNavigation('mybank://authorise/3ds/1', topFrame(['com.shop.app']))).toBe(
      'external',
    );
  });

  it('keeps a relative navigation in the web view', () => {
    expect(classifyNavigation('/checkout/step-2', topFrame())).toBe('load');
  });

  it('refuses the return link from a frame inside the page, rather than ending the checkout', () => {
    expect(classifyNavigation('myapp://payment-return?success=1&invoice_id=4512', subFrame())).toBe(
      'block',
    );
  });

  it('refuses a bank app asked for by a frame inside the page', () => {
    expect(classifyNavigation('mybank://authorise/3ds/9', subFrame())).toBe('block');
  });

  it('still lets a frame inside the page load ordinary web content', () => {
    expect(classifyNavigation('https://3ds.issuer.example/step', subFrame())).toBe('load');
    expect(classifyNavigation('/challenge', subFrame())).toBe('load');
  });
});
