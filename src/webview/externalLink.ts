import { Linking } from 'react-native';

/**
 * Hands a link the checkout cannot load itself — a bank app for 3-D Secure, `tel:`,
 * `mailto:` — to the phone.
 *
 * The link is opened straight away, without asking `Linking.canOpenURL` first. That check
 * answers false for every scheme the host app has not declared (`LSApplicationQueriesSchemes`
 * on iOS, `<queries>` on Android 11 and later), and no app can declare every bank's scheme,
 * so a bank-app step would silently do nothing. `openURL` needs no such declaration. What
 * may be opened at all is decided before this, by `classifyNavigation`.
 *
 * `onFailure` is called when nothing on the phone can open the link, which is how the
 * payer is told why the step they were sent on did nothing. Swallowing it would leave them
 * on a checkout whose button does nothing — and with `headerShown` off, no way out of the
 * screen at all, so the `open()` promise would never settle.
 */
export function openExternalLink(url: string, onFailure: () => void): void {
  void Linking.openURL(url).catch(() => onFailure());
}
