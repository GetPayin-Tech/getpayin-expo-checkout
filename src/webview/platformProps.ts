import type { PlatformName } from '../types';

/**
 * The web view settings the wallets depend on.
 *
 * Every one of these fails silently when it is wrong: the wallet button simply does not
 * appear, with nothing in the log to say why. They are built here, per platform, so no
 * client has to copy them out of a document and no caller can pass something that turns a
 * wallet off.
 */
export interface CheckoutWebViewPlatformProps {
  readonly originWhitelist: string[];
  readonly javaScriptEnabled: boolean;
  readonly enableApplePay?: boolean;
  readonly paymentRequestEnabled?: boolean;
}

/**
 * Builds the platform settings for the checkout web view.
 *
 * `originWhitelist` is `*` so the view is handed the app's own return scheme itself. With
 * the default list the web view gives that link to the phone instead, and the result
 * screen opens on top of a checkout that has already been paid.
 *
 * On iOS `enableApplePay` is set and nothing is injected into the page. WebKit turns Apple
 * Pay off on any page the host app has added scripts to, so this package sends no
 * `injectedJavaScript` and registers no `onMessage` on iOS — not anywhere, not even for
 * diagnostics.
 *
 * On Android `paymentRequestEnabled` is what lets Google Pay run in a web view. The user
 * agent is deliberately left alone, because Google checks it and requires it to end with
 * `GOOGLE_PAY_SUPPORTED`.
 */
export function buildCheckoutWebViewProps(platform: PlatformName): CheckoutWebViewPlatformProps {
  const shared = {
    originWhitelist: ['*'],
    javaScriptEnabled: true,
  };

  if (platform === 'ios') {
    return { ...shared, enableApplePay: true };
  }

  if (platform === 'android') {
    return { ...shared, paymentRequestEnabled: true };
  }

  return shared;
}
