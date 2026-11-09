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
- Google Pay on Android, in the app's own screen behind `googlePayInApp` and in the
  phone's browser sheet before Google has approved the app.
- `expectedInvoiceId`, which reports a return link naming a different invoice as
  `not_paid` rather than taking it at its word. Pass it whenever you have it.
- `createPaymentReturnRedirect()` for the `+native-intent` file an expo-router app needs.
  Matching is on whole path segments, so a similarly named route of your own still opens.
- `statusResolver` for integrations whose return link reports its outcome under parameter
  names the built-in reader does not know.
- `GetPayInCheckout.presentationFor()` and `GetPayInCheckout.busy` for diagnostics and for
  guarding a Pay button.

### Security

The return link is a public app scheme that anything on the phone can invoke. The
following are built in; none of them replaces confirming the `invoice.paid` webhook on
your server. See [`docs/security.md`](docs/security.md).

- The link the app was launched with never settles a checkout opened afterwards. A forged
  link that cold-starts the app is taken out of circulation before any checkout can read
  it. Values pulled from `getInitialURL()` are consumed once per process; links pushed by
  the `url` event are not, so a second genuine checkout still works when its return link
  is byte-identical to the first.
- A return link whose status cannot be read is reported as `not_paid`, never `paid`.
- A sheet URL that is not the return link no longer settles a checkout.
- `javascript:` and `vbscript:` navigations are refused rather than handed to the phone.
- The app's own scheme is refused whenever it is not the return link, so a checkout page —
  which during a 3-D Secure step is hosted by the issuer, not by GetPayIn — cannot drive
  the host app's deep-link routes.
- A handoff to another app goes through `Linking.canOpenURL` first. On iOS this means a
  bank app's scheme must be declared in `LSApplicationQueriesSchemes`; see
  [`docs/setup.md`](docs/setup.md).
- The shipped bundle is checked on every build for a signing secret, an injected script, a
  message bridge, a user-agent override and the presence of the wallet settings.
