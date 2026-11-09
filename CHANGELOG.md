# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the package follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-09

First release.

### Added

- `GetPayInProvider` and `GetPayInCheckout.open()` for taking a payment on the hosted
  GetPayIn checkout inside an Expo app.
- `GetPayInCheckoutView` for placing the checkout in a screen of your own navigation
  instead of the provider's modal.
- Apple Pay on iOS and card everywhere, drawn in the app's own screen.
- The in-app screen's top bar keeps clear of the status bar on Android, where the modal
  draws edge-to-edge. It uses `react-native-safe-area-context`, now a peer dependency,
  instead of React Native's own `SafeAreaView`, which is deprecated and pads only on iOS.
- Google Pay on Android, in the app's own screen behind `googlePayInApp` and in the
  phone's browser sheet before Google has approved the app.
- `expectedInvoiceId`, which reports a return link naming a different invoice as
  `not_paid` rather than taking it at its word. Pass it whenever you have it. It takes the
  invoice id as text or as the number init returns; both sides are reduced to trimmed text,
  with leading zeros ignored on a digits-only id, so the number a server sends and the text
  a link carries are one invoice. `null`, an empty value or a number that is not a safe
  integer is refused with `GetPayInConfigError` instead of quietly turning the check off or
  reporting every real payment as not paid.
- `createPaymentReturnRedirect()` for the `+native-intent` file an expo-router app needs.
  Matching is on whole path segments, so a similarly named route of your own still opens.
- `GetPayInCheckout.presentationFor()` and `GetPayInCheckout.busy` for diagnostics and for
  guarding a Pay button.
- Tested against Expo 58 (React Native 0.88, react-native-webview 14). The loading
  overlay no longer uses `StyleSheet.absoluteFillObject`, which React Native 0.88 removed;
  `StyleSheet.absoluteFill` is still there and is what it spreads. The toolchain and CI run
  on Node 22 and 24, which is what Expo 58's own dependencies require.
- `closeLabel`, `loadErrorMessage` and `linkErrorMessage`, so an app in another language,
  Arabic for example, shows the payer its own words instead of English ones. Blank text —
  which is what `t('key')` returns for a missing translation key — falls back to the
  English default rather than being shown, so a close button never loses its label.
- `invoiceStatus` and `code` on `CheckoutResult`. `invoiceStatus` is the invoice state the
  link reported; only `PAID` is `paid`, so an `AUTHORIZED` or `PARTIALLY_PAID` invoice is
  no longer reported as an order to fulfil. `code` says why a `not_paid` is not a decline —
  `unreadable_return_link`, `wrong_invoice` or `unexpected_invoice_status` — which is what
  tells an unreadable link apart from a genuine decline, and what to alert on.
- `hostAppSchemes()` and `schemesFromAppConfig()` are exported, so an app embedding the
  checkout in a web view of its own can build the list `createNavigationHandler` needs.
  `ownSchemes` is now required rather than defaulting to none: defaulted, the block was off
  for exactly the callers the documentation pointed at it.

### Changed

- `classifyNavigation(url, returnUrl, ownSchemes?)` is now
  `classifyNavigation(url, { returnUrl, ownSchemes, isTopFrame })`, and
  `createNavigationHandler`'s handler takes `{ url, isTopFrame }` rather than a URL.
  `ownSchemes` and `isTopFrame` are both required: each was a fail-open default on the one
  path the documentation pointed integrators at.
- `onLoadError` takes a second argument. The first is the text for the payer, in the app's
  language; the second is the developer-facing cause, which names the option and the value
  it got. An unusable `expectedInvoiceId` used to put that text on the payment screen.
- `@testing-library/react-native` and `react-test-renderer` are gone from the dev
  dependencies. Nothing imported them: the component logic lives in `webview/` and
  `sessions/`, where the suite covers it without a render harness.

### Security

The return link is a public app scheme that anything on the phone can invoke. The
following are built in; none of them replaces confirming the `invoice.paid` webhook on
your server. See [`docs/security.md`](docs/security.md).

- The link the app was launched with never settles a checkout opened afterwards. A forged
  link that cold-starts the app is taken out of circulation before any checkout can read
  it. Values pulled from `getInitialURL()` are consumed once per process; links pushed by
  the `url` event are not, so a second genuine checkout still works when its return link
  is byte-identical to the first.
- The return link is read by GetPayIn's own fields only (`success`, `invoice_id`,
  `invoice_status`, `message`), by their exact names. A link that repeats **any** field,
  `signature` included, or that carries a name only a looser reader would take for one of
  those four — `Success`, `invoiceId`, `%73uccess` — is `not_paid` with
  `unreadable_return_link`. A field GetPayIn does not send, such as `status=paid`, cannot
  change the outcome, and the package cannot read a different invoice out of a link than a
  server checking its signature would.
- A return link whose status cannot be read is reported as `not_paid`, never `paid`, and
  the link's own message is not shown: GetPayIn always sends one, so keeping it would make
  an unreadable link indistinguishable from a decline — and a link reading
  `success=true&message=Payment+completed` would have told the payer the payment had
  succeeded while the app was told it had not.
- A navigation a frame inside the checkout page asks for can only ever load ordinary web
  content. It never ends the checkout and never reaches another app. A 3-D Secure page is
  the issuer's and knows the real invoice id, so an `<iframe>` aimed at the return link
  would otherwise report a payment nobody made, which `expectedInvoiceId` cannot catch.
- A sheet URL that is not the return link no longer settles a checkout.
- `javascript:` and `vbscript:` navigations are refused rather than handed to the phone, as
  are schemes with no part in paying for anything: `market:`, `itms-apps:`,
  `itms-services:`, `sms:`, `smsto:`, `mms:`, `shortcuts:`, `content:` and `android-app:`.
  The link is opened with no confirmation of any kind, and a browser would refuse most of
  these from the same page. `tel:`, `mailto:` and Android's `intent:` stay allowed.
- Every scheme the app answers to is refused whenever it is not the return link — the
  return link's scheme, the other schemes in the app config, an Android intent filter's
  schemes, `ios.infoPlist.CFBundleURLTypes`, the iOS bundle identifier, the Android package
  name and the development-build scheme `exp+<slug>` (read through `expo-constants`, now a
  peer dependency) — so a checkout page, which during a 3-D Secure step is hosted by the
  issuer, not by GetPayIn, cannot drive the host app's deep-link routes. Reading the app
  config cannot take the checkout screen down with it: `Constants.expoConfig` throws rather
  than returning null in a build with no embedded manifest.
- A handoff to another app (a bank app for 3-D Secure, `tel:`, `mailto:`) is opened with
  `Linking.openURL` directly, not after `Linking.canOpenURL`, which answers no for every
  scheme the app has not declared. No bank scheme has to be declared. A link nothing on the
  phone can open is reported through `onLoadError`, so the payer is told why the step did
  nothing and the top bar appears — with the failure swallowed, a payer on a screen with
  `headerShown` off had no way out and the `open()` promise never settled.
- The shipped bundle is checked on every build for a signing secret, an injected script, a
  message bridge, a user-agent override and the presence of the wallet settings.
