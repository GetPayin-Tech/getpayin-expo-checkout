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
 * Decides how one navigation request is handled.
 *
 * `return` ends the checkout. `load` stays in the web view. `block` is refused outright.
 * `external` is handed to the phone so a bank app can take a 3-D Secure step and `tel:`
 * or `mailto:` still work; every acquirer has its own set of bank schemes, so that cannot
 * be an allow-list here, and the caller gates it on whether the phone has a handler at
 * all.
 *
 * The app's own scheme is blocked whenever it is not the return link. A 3-D Secure step
 * is hosted by the issuer, not by GetPayIn, so the page driving these navigations is not
 * one this package controls — and a page that could reach the app's own scheme would be
 * driving the host app's deep-link routes, which no checkout has any business doing.
 */
export function classifyNavigation(url: string, returnUrl: string): NavigationDecision {
  if (matchesReturnUrl(url, returnUrl)) {
    return 'return';
  }

  const parsed = parseUrl(url);

  if (!parsed) {
    return 'load';
  }

  if (BLOCKED_SCHEMES.has(parsed.scheme)) {
    return 'block';
  }

  if (WEB_SCHEMES.has(parsed.scheme)) {
    return 'load';
  }

  return parsed.scheme === parseUrl(returnUrl)?.scheme ? 'block' : 'external';
}
