import { matchesReturnUrl } from './returnUrl';
import { parseUrl } from './url';

/** What the web view should do with a navigation request. */
export type NavigationDecision = 'return' | 'external' | 'load' | 'block';

const WEB_SCHEMES = new Set(['http', 'https', 'about', 'data', 'blob', 'file']);

/**
 * Schemes that are never handed to the phone and never navigated to.
 *
 * `external` ends in `Linking.openURL`, and the checkout page is what decides where the
 * web view navigates. A script scheme has no legitimate part in a checkout and must not
 * reach `openURL`, where what happens next is up to whatever the phone hands it to.
 */
const BLOCKED_SCHEMES = new Set(['javascript', 'vbscript']);

/**
 * Schemes refused even though another app may well answer to them.
 *
 * The page driving a 3-D Secure step is hosted by the issuer, not by GetPayIn, and the
 * link is opened with no confirmation of any kind, so the set of apps a checkout can reach
 * has to exclude the ones with nothing to do with paying: installing something from a
 * store, sending a message on the payer's behalf, running a Shortcuts automation, reading
 * a content provider. None belongs in a card payment, and a browser would refuse most of
 * them from the same page.
 *
 * Bank schemes cannot be an allow-list — every acquirer has its own set — so this is the
 * other way round, and `tel:`, `mailto:` and Android's `intent:` stay allowed because a
 * genuine checkout uses them.
 */
const REFUSED_APP_SCHEMES = new Set([
  'market',
  'itms-apps',
  'itms-services',
  'itms-beta',
  'sms',
  'smsto',
  'mms',
  'shortcuts',
  'x-apple-shortcuts',
  'content',
  'android-app',
]);

/** What {@link classifyNavigation} needs in order to decide about one navigation. */
export interface NavigationContext {
  /** The link the checkout was opened with, which is what ends it. */
  readonly returnUrl: string;

  /**
   * Every other scheme the host app answers to, refused like the return link's scheme.
   * `hostAppSchemes()` reads them from the app config; pass `[]` only for an app that
   * answers to nothing but its return link.
   */
  readonly ownSchemes: readonly string[];

  /**
   * Whether the navigation was started by the page itself rather than by a frame inside
   * it. `react-native-webview` reports it as `isTopFrame` on the request.
   *
   * A sub-frame gets nothing but ordinary web navigation: an `<iframe>` on the issuer's
   * 3-D Secure page, which knows the real invoice id, could otherwise point itself at the
   * return link and end the checkout as `paid` with no payment made.
   */
  readonly isTopFrame: boolean;
}

/** True when `scheme` is one the host app itself answers to. */
function isOwnScheme(scheme: string, context: NavigationContext): boolean {
  return (
    scheme === parseUrl(context.returnUrl)?.scheme ||
    context.ownSchemes.some((own) => own.trim().toLowerCase() === scheme)
  );
}

/**
 * Decides how one navigation request is handled.
 *
 * `return` ends the checkout. `load` stays in the web view. `block` is refused outright.
 * `external` is handed to the phone so a bank app can take a 3-D Secure step and `tel:` or
 * `mailto:` still work. The caller opens it directly (see `openExternalLink`), because
 * asking the phone first answers no for every scheme the host app has not declared.
 *
 * The app's own schemes are blocked whenever the link is not the return link: the return
 * link's scheme, and `ownSchemes`, every other scheme the app answers to (see
 * `hostAppSchemes`). A 3-D Secure step is hosted by the issuer, not by GetPayIn, so the
 * page driving these navigations is not one this package controls — and a page that could
 * reach one of the app's schemes would be driving the host app's deep-link routes, which
 * no checkout has any business doing.
 *
 * A navigation from a sub-frame can only ever `load` or be blocked. Nothing a frame inside
 * the page asks for ends the checkout or reaches another app.
 */
export function classifyNavigation(url: string, context: NavigationContext): NavigationDecision {
  const subFrame = !context.isTopFrame;

  if (matchesReturnUrl(url, context.returnUrl)) {
    return subFrame ? 'block' : 'return';
  }

  const parsed = parseUrl(url);

  if (!parsed) {
    return 'load';
  }

  if (BLOCKED_SCHEMES.has(parsed.scheme) || REFUSED_APP_SCHEMES.has(parsed.scheme)) {
    return 'block';
  }

  if (WEB_SCHEMES.has(parsed.scheme)) {
    return 'load';
  }

  if (isOwnScheme(parsed.scheme, context)) {
    return 'block';
  }

  return subFrame ? 'block' : 'external';
}
