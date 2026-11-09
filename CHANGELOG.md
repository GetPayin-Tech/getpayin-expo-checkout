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
  invoice id as text or as the number init returns; the two are compared as text. `null`
  or an empty value is refused with `GetPayInConfigError` instead of quietly turning the
  check off.
- `createPaymentReturnRedirect()` for the `+native-intent` file an expo-router app needs.
  Matching is on whole path segments, so a similarly named route of your own still opens.
- `GetPayInCheckout.presentationFor()` and `GetPayInCheckout.busy` for diagnostics and for
  guarding a Pay button.
- Tested against Expo 58 (React Native 0.88, react-native-webview 14). The loading
  overlay no longer uses `StyleSheet.absoluteFillObject`, which React Native 0.88 removed.
- `closeLabel` and `loadErrorMessage`, so an app in another language, Arabic for example,
  shows the payer its own words instead of English ones.

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
  `message`), by their exact names, and a link that repeats one of them is `not_paid`. A
  field GetPayIn does not send, such as `status=paid`, cannot change the outcome, and the
  package cannot read a different invoice out of a link than a server checking its
  signature would.
- A return link whose status cannot be read is reported as `not_paid`, never `paid`.
- A sheet URL that is not the return link no longer settles a checkout.
- `javascript:` and `vbscript:` navigations are refused rather than handed to the phone.
- Every scheme the app answers to is refused whenever it is not the return link — the
  return link's scheme, the other schemes in the app config, the iOS bundle identifier, the
  Android package name and the development-build scheme `exp+<slug>` (read through
  `expo-constants`, now a peer dependency) — so a
  checkout page, which during a 3-D Secure step is hosted by the issuer, not by GetPayIn,
  cannot drive the host app's deep-link routes.
- A handoff to another app (a bank app for 3-D Secure, `tel:`, `mailto:`) is opened with
  `Linking.openURL` directly, not after `Linking.canOpenURL`, which answers no for every
  scheme the app has not declared. No bank scheme has to be declared. A link nothing can
  open fails quietly and leaves the checkout as it was.
- The shipped bundle is checked on every build for a signing secret, an injected script, a
  message bridge, a user-agent override and the presence of the wallet settings.
