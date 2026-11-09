# Setup

Everything you need in place before a payment can work, and the configuration the wallets
depend on.

## Prerequisites

1. **A development or store build.** Expo Go cannot receive your app's return link, so
   payments start but your app never gets the result. Use `npx expo run:ios` /
   `npx expo run:android`, or an EAS build.
2. **A GetPayIn integration of type "Mobile App"**, with **Mobile App Return Scheme** set
   to your app's scheme (`app.json` → `expo.scheme`). Set both in the GetPayIn dashboard
   under **Settings → Payment Integrations**.
3. **Your own server.** It calls `POST /api/integration/init` to create the payment and
   confirms the result afterwards. Your hash token stays there and never goes into the
   app. The server-side SDK for that is
   [`@getpayin/getpayin`](https://www.npmjs.com/package/@getpayin/getpayin).

## Install

```bash
npx expo install @getpayin/expo-checkout react-native-webview expo-web-browser expo-linking
```

Then rebuild. The web view is native code, so a JavaScript-only reload will not pick it
up.

## Your app's scheme

The return link is built from your app's scheme, and it has to match the integration's
**Mobile App Return Scheme** exactly.

```json
{
  "expo": {
    "scheme": "myapp"
  }
}
```

With that, `myapp://payment-return` is your return link. The path can be anything you
like, as long as the dashboard and your `open()` call agree on it.

## The provider

Mount it once, at the root of the app, above your navigation:

```tsx
// app/_layout.tsx (expo-router) or App.tsx
import { GetPayInProvider } from '@getpayin/expo-checkout';

export default function RootLayout() {
  return <GetPayInProvider>{/* your navigation */}</GetPayInProvider>;
}
```

The provider draws the checkout in a full-screen modal with your app's own top bar.
`GetPayInCheckout.open()` needs it in order to present anything on iOS, and on Android
once `googlePayInApp` is on. Without it, an in-app checkout rejects with
`GetPayInProviderMissingError`.

## expo-router

expo-router treats the returning deep link as a route and shows "Unmatched Route" on top
of a checkout that has already been paid. One file fixes it:

```tsx
// app/+native-intent.tsx
import { createPaymentReturnRedirect } from '@getpayin/expo-checkout';

export const redirectSystemPath = createPaymentReturnRedirect('myapp://payment-return');
```

A cold start lands on your first screen; a link that arrives while the app is running is
dropped, because the package already has the result by then. Matching is on whole path
segments, so your own `/help/payment-returns-policy` route still opens normally.

Pass a second argument to land somewhere other than `/`:

```tsx
export const redirectSystemPath = createPaymentReturnRedirect('myapp://payment-return', '/home');
```

## React Navigation

Nothing extra. Mount `GetPayInProvider` above your navigator and the modal sits over it.

## iOS

Apple Pay needs no configuration in your app. It works in the checkout screen as long as
you use the package's view as it is.

One case does need a declaration. If your acquirer's 3-D Secure flow hands the payer to a
**bank app** rather than a web page, iOS will not open that app unless its scheme is
declared:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "LSApplicationQueriesSchemes": ["yourbankscheme"]
      }
    }
  }
}
```

Ask GetPayIn support which schemes apply to your acquirer. Most 3-D Secure steps are web
pages and need nothing here.

## Android

Nothing to configure for Google Pay in the browser sheet, which is the default.
`react-native-webview` 13.15.0 and later already declare the three entries Google asks
for (`org.chromium.intent.action.PAY`, `IS_READY_TO_PAY`, `UPDATE_PAYMENT_DETAILS`) and
ship androidx.webkit 1.14.0, so no config plugin is needed.

For Google Pay inside your app's own screen, see [Google Pay on Android](google-pay.md).

## What not to do

1. **Do not pass `checkoutUrl` through a navigation parameter.** expo-router decodes it a
   second time, which breaks the link's signature and the checkout answers HTTP 403. Keep
   it in memory and hand it straight to `open()`.
2. **Do not add scripts to the checkout view.** No `injectedJavaScript`, no `onMessage`,
   nothing. WebKit turns Apple Pay off on any page the host app has added scripts to, with
   no error to say so.
3. **Do not change the web view's user agent.** Google checks it, and it has to end with
   `GOOGLE_PAY_SUPPORTED`.
4. **Do not use the checkout's `iframe` mode.** It only allows the integration's
   registered website as the page around it, and an app screen has none.

## Next

[Taking payments](taking-payments.md).
