import { Linking } from 'react-native';

/**
 * Hands a link the checkout cannot load itself — a bank app for 3-D Secure, `tel:`,
 * `mailto:` — to the phone.
 *
 * The link is opened straight away, without asking `Linking.canOpenURL` first. That check
 * answers false for every scheme the host app has not declared (`LSApplicationQueriesSchemes`
 * on iOS, `<queries>` on Android 11 and later), and no app can declare every bank's scheme,
 * so a bank-app step would silently do nothing. `openURL` needs no such declaration.
 *
 * A link nothing on the phone can open fails quietly. The checkout stays where it was and
 * the payer can carry on there, so the failure is not reported as a load error, which
 * would replace the whole checkout.
 */
export function openExternalLink(url: string): void {
  void Linking.openURL(url).catch(() => undefined);
}
