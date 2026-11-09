---
name: getpayin-expo-checkout
description: Integrate GetPayIn mobile payments into an Expo or React Native app with @getpayin/expo-checkout — Apple Pay, Google Pay and card on the hosted checkout. Use when adding or debugging in-app payments, when the user mentions GetPayIn, Apple Pay or Google Pay in Expo or React Native, a payment WebView, a payment return deep link, GetPayInProvider, GetPayInCheckout.open, or symptoms such as a missing wallet button, HTTP 403 from a checkout link, or an app that never receives the payment result.
---

# GetPayIn Expo checkout integration

`@getpayin/expo-checkout` opens the hosted GetPayIn checkout inside an Expo app and
reports what came back. It holds no secret and signs nothing.

## The rule that matters most

**The result in the app is never proof of payment.** The app's return scheme is public, so
anything on the phone can open the app with
`myapp://payment-return?status=paid&invoice_id=anything`.

So when writing integration code: `status === 'paid'` may update the UI, but only the
server's `invoice.paid` webhook may unlock, ship, credit or grant anything. If the user
asks for an app-side-only confirmation, say why that is unsafe and offer the server check.

## Quick start

```tsx
// 1. app/_layout.tsx (expo-router) or App.tsx — mount once at the root
import { GetPayInProvider } from '@getpayin/expo-checkout';

export default function RootLayout() {
  return <GetPayInProvider>{/* navigation */}</GetPayInProvider>;
}
```

```tsx
// 2. Take a payment
import { GetPayInCheckout } from '@getpayin/expo-checkout';

const { checkoutUrl, invoiceId } = await myApi.createPayment(order);

const result = await GetPayInCheckout.open(checkoutUrl, {
  returnUrl: 'myapp://payment-return',
  expectedInvoiceId: invoiceId,
  googlePayInApp: false,
});

if (result.status === 'paid') {
  await myApi.confirmPayment(result.invoiceId);
}
```

```tsx
// 3. app/+native-intent.tsx — expo-router only, or payers see "Unmatched Route"
import { createPaymentReturnRedirect } from '@getpayin/expo-checkout';

export const redirectSystemPath = createPaymentReturnRedirect('myapp://payment-return');
```

`result.status` is `paid`, `not_paid` or `cancelled`.

## Instructions

When integrating:

1. **Install and rebuild.**
   `npx expo install @getpayin/expo-checkout react-native-webview expo-web-browser expo-linking`,
   then `npx expo run:ios` / `run:android` or an EAS build. The web view is native code,
   so a JS reload is not enough.
2. **Check the three places the scheme must agree:** `expo.scheme` in `app.json`, the
   integration's **Mobile App Return Scheme** in the GetPayIn dashboard, and
   `options.returnUrl`. A mismatch means the payment works and the app never hears back.
3. **Always pass `expectedInvoiceId`.** It makes the package reject a `paid` link naming a
   different invoice. Never omit it when the server returned an invoice id.
4. **Keep `googlePayInApp: false`** unless the user confirms Google has approved their
   app. Setting it early gives Android payers an app screen with no Google Pay button and
   no error.
5. **Pass `checkoutUrl` in memory.** Never through a route or navigation parameter —
   expo-router decodes it twice and the checkout answers HTTP 403.
6. **Add the expo-router `+native-intent.tsx` file** if the project uses expo-router.
   Check for an `app/` directory to tell.
7. **Wire the server side**: `POST /api/integration/init` to create, `invoice.paid` webhook
   to confirm. Use `@getpayin/getpayin` there; it verifies webhook signatures.

## Never do these

1. Never put the hash token, or any signing, in the app. It belongs on the server.
2. Never add `injectedJavaScript`, `onMessage` or any other script to the checkout view or
   to a web view around it. WebKit turns Apple Pay off on any scripted page, silently.
3. Never set `userAgent` on the checkout web view. Google checks it and requires it to end
   with `GOOGLE_PAY_SUPPORTED`.
4. Never use the checkout's `iframe: true` mode in an app. It requires the integration's
   registered website as the surrounding page.
5. Never treat the return link alone as authorisation to deliver.
6. Never tell the user Expo Go will work. It cannot receive the return link.

## Diagnosing

Match the symptom first; most of these failures are silent.

| Symptom                                   | First thing to check                                                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Payment works, app never gets the result  | Running in Expo Go; then the scheme in all three places                                                                       |
| "Unmatched Route" after paying            | Missing `app/+native-intent.tsx`                                                                                              |
| HTTP 403 from the checkout link           | `checkoutUrl` passed through a route parameter; or `(`, `)`, `'` in the order title                                           |
| No Apple Pay button on iPhone             | A script was added to the page; no card in Wallet                                                                             |
| No Google Pay button on Android           | Google has not approved the app — use `googlePayInApp: false`; WebView < 137; Play services < 25.18.30; overridden user agent |
| Blank white checkout screen               | Load failure; `onLoadError` not handled in a custom screen                                                                    |
| `GetPayInProviderMissingError`            | `GetPayInProvider` not mounted — note iOS always uses the in-app screen                                                       |
| `GetPayInSessionBusyError`                | Double tap on Pay; guard with `GetPayInCheckout.busy`                                                                         |
| Real payment came back `cancelled`        | Scheme mismatch; the webhook is the authority                                                                                 |
| `not_paid` mentioning a different invoice | `expectedInvoiceId` rejected a mismatched link — check which invoice the server created                                       |

## API surface

| Export                                                 | Purpose                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| `GetPayInProvider`                                     | Hosts the in-app checkout. Mount once at the root.                       |
| `GetPayInCheckout.open(url, options)`                  | Opens a checkout, resolves with a `CheckoutResult`. All failures reject. |
| `GetPayInCheckout.presentationFor(options)`            | `'in-app'` or `'browser'` for this phone, without opening anything.      |
| `GetPayInCheckout.busy`                                | True while a checkout is open.                                           |
| `GetPayInCheckoutView`                                 | The checkout for a screen of your own. Handle `onLoadError`.             |
| `createPaymentReturnRedirect(returnUrl, initialPath?)` | The expo-router `+native-intent` export.                                 |
| `CheckoutStatus`                                       | `{ Paid, NotPaid, Cancelled }`.                                          |

Options: `returnUrl` (required), `expectedInvoiceId`, `googlePayInApp`, `title`,
`headerShown`, `statusResolver`, `presentation`.

Errors, all extending `GetPayInCheckoutError`: `GetPayInConfigError`,
`GetPayInProviderMissingError`, `GetPayInSessionBusyError`.

## Platform behaviour

| Platform | `googlePayInApp`  | Opens in                  | Wallets          |
| -------- | ----------------- | ------------------------- | ---------------- |
| iOS      | ignored           | The app's own screen      | Apple Pay, card  |
| Android  | `false` (default) | The phone's browser sheet | Google Pay, card |
| Android  | `true`            | The app's own screen      | Google Pay, card |

Google Pay is never offered on iPhone — Google allows it only in Safari.

## Full documentation

In the package repository: `docs/setup.md`, `docs/taking-payments.md`,
`docs/google-pay.md`, `docs/api.md`, `docs/security.md`, `docs/troubleshooting.md`.
