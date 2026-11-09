# @getpayin/expo-checkout

Take Apple Pay, Google Pay and card payments in your Expo app. The hosted GetPayIn
checkout opens inside your app, under your app's own top bar, with no browser bar.

| Phone                                    | Where the checkout opens  | Payment methods  |
| ---------------------------------------- | ------------------------- | ---------------- |
| iPhone                                   | Your app's own screen     | Apple Pay, card  |
| Android, after Google approves your app  | Your app's own screen     | Google Pay, card |
| Android, before Google approves your app | The phone's browser sheet | Google Pay, card |

Google Pay is not offered on iPhone: Google only allows it in Safari, not inside apps.

This package holds no secret and signs nothing. Your server creates the payment and
confirms it; the app only shows the checkout and reports what came back.

## Install

```bash
npx expo install @getpayin/expo-checkout react-native-webview expo-web-browser expo-linking
```

Then rebuild your app (`npx expo run:ios`, `npx expo run:android`, or a new EAS build).
Installing alone is not enough: the web view is native code.

You also need a development or store build, a GetPayIn integration of type **Mobile App**,
and a server that creates and confirms payments. [Setup](docs/setup.md) covers all three.

## Quick start

Wrap your app once:

```tsx
// app/_layout.tsx (expo-router) or App.tsx
import { GetPayInProvider } from '@getpayin/expo-checkout';

export default function RootLayout() {
  return <GetPayInProvider>{/* your navigation */}</GetPayInProvider>;
}
```

Then take a payment:

```tsx
import { GetPayInCheckout } from '@getpayin/expo-checkout';

// Your server calls POST /api/integration/init and sends back checkout_url.
const { checkoutUrl, invoiceId } = await myApi.createPayment(order);

const result = await GetPayInCheckout.open(checkoutUrl, {
  returnUrl: 'myapp://payment-return', // must match your Mobile App Return Scheme
  expectedInvoiceId: invoiceId, // ties the result to this checkout — always pass it
  googlePayInApp: false, // set true only after Google approves your app
});

if (result.status === 'paid') {
  await myApi.confirmPayment(result.invoiceId);
}
```

`result.status` is `paid`, `not_paid` or `cancelled`.

> **The result in the app is not proof of payment.** Your return scheme is public, so
> anything on the phone can forge that link. Confirm the `invoice.paid` webhook on your
> server before you deliver the order. [Security model](docs/security.md) explains what the
> package does on its side and why it is not enough on its own.

If you use expo-router, you need one more file or payers will see "Unmatched Route" after
paying — see [Setup](docs/setup.md#expo-router).

## Documentation

| Guide                                       | What is in it                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [Setup](docs/setup.md)                      | Prerequisites, install, the provider, expo-router, and the iOS and Android configuration.  |
| [Taking payments](docs/taking-payments.md)  | Opening a checkout, reading the result, confirming it, retries, and using your own screen. |
| [Google Pay on Android](docs/google-pay.md) | Getting Google's approval for in-app Google Pay, and the device requirements.              |
| [API reference](docs/api.md)                | Every export, option, type and error.                                                      |
| [Security model](docs/security.md)          | What the package guarantees, what it cannot, and what your server must do.                 |
| [Troubleshooting](docs/troubleshooting.md)  | The failures that are silent: no wallet button, HTTP 403, a blank screen.                  |
| [Architecture](docs/architecture.md)        | How the package is laid out and why, for anyone changing it.                               |

## Contributing

[`CONTRIBUTING.md`](CONTRIBUTING.md) has the layering rules, the house style and the
by-hand device checks. [`CHANGELOG.md`](CHANGELOG.md) records what changed.

## Reporting a vulnerability

Privately, please — see [`SECURITY.md`](SECURITY.md).

## License

MIT
