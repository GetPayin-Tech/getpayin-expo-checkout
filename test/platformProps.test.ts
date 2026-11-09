import { describe, expect, it } from 'vitest';

import { buildCheckoutWebViewProps } from '../src/webview/platformProps';

describe('buildCheckoutWebViewProps', () => {
  it.each(['ios', 'android', 'web'])('whitelists every origin on %s', (platform) => {
    expect(buildCheckoutWebViewProps(platform).originWhitelist).toEqual(['*']);
  });

  it('turns Apple Pay on for iOS', () => {
    expect(buildCheckoutWebViewProps('ios').enableApplePay).toBe(true);
  });

  it('leaves the Android payment flag off iOS', () => {
    expect(buildCheckoutWebViewProps('ios').paymentRequestEnabled).toBeUndefined();
  });

  it('turns the payment request API on for Android', () => {
    expect(buildCheckoutWebViewProps('android').paymentRequestEnabled).toBe(true);
  });

  it('leaves the Apple Pay flag off Android', () => {
    expect(buildCheckoutWebViewProps('android').enableApplePay).toBeUndefined();
  });

  it.each(['ios', 'android', 'web'])('injects no script and no bridge on %s', (platform) => {
    const props = buildCheckoutWebViewProps(platform) as unknown as Record<string, unknown>;

    expect(props.injectedJavaScript).toBeUndefined();
    expect(props.injectedJavaScriptBeforeContentLoaded).toBeUndefined();
    expect(props.onMessage).toBeUndefined();
  });

  it.each(['ios', 'android', 'web'])('never overrides the user agent on %s', (platform) => {
    const props = buildCheckoutWebViewProps(platform) as unknown as Record<string, unknown>;

    expect(props.userAgent).toBeUndefined();
    expect(props.applicationNameForUserAgent).toBeUndefined();
  });

  it('enables JavaScript, which the checkout needs', () => {
    expect(buildCheckoutWebViewProps('ios').javaScriptEnabled).toBe(true);
  });
});
