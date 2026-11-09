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
 * be an allow-list here. The caller opens it directly (see `openExternalLink`), because
 * asking the phone first answers no for every scheme the host app has not declared.
 *
 * The app's own schemes are blocked whenever the link is not the return link: the return
 * link's scheme, and `ownSchemes`, every other scheme the app answers to (see
 * `hostAppSchemes`). A 3-D Secure step is hosted by the issuer, not by GetPayIn, so the
 * page driving these navigations is not one this package controls — and a page that could
 * reach one of the app's schemes would be driving the host app's deep-link routes, which
 * no checkout has any business doing.
 */
export function classifyNavigation(
  url: string,
  returnUrl: string,
  ownSchemes: readonly string[] = [],
): NavigationDecision {
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

  const isOwnScheme =
    parsed.scheme === parseUrl(returnUrl)?.scheme ||
    ownSchemes.some((scheme) => scheme.trim().toLowerCase() === parsed.scheme);

  return isOwnScheme ? 'block' : 'external';
}
