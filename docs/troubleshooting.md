# Troubleshooting

Most of what goes wrong here fails **silently**: the wallet button is simply absent, or the
payment completes and your app never hears about it. Nothing appears in the log. This page
is ordered by symptom.

## The payment works but my app never gets the result

1. **You are running in Expo Go.** It cannot receive your app's return link. Use
   `npx expo run:ios` / `npx expo run:android`, or an EAS build. This is the single most
   common cause.
2. **The return scheme does not match.** `options.returnUrl` must match the **Mobile App
   Return Scheme** on the integration, and that must match `expo.scheme` in `app.json`.
   All three.
3. **You changed `app.json` without rebuilding.** The scheme is native configuration.

## Payers see "Unmatched Route" after paying

You use expo-router and have not added `app/+native-intent.tsx`. See
[Setup](setup.md#expo-router).

## The checkout answers HTTP 403

The link's signature no longer matches what was signed.

1. **You passed `checkoutUrl` through a navigation parameter.** expo-router decodes it a
   second time. Keep it in memory and hand it straight to `open()`.
2. **The order title contains unusual characters.** Characters such as `(`, `)` and `'` in
   `order_title` can break the signature. Keep titles to letters, numbers and spaces, and
   check with GetPayIn support whether the backend fix for this has shipped.

## No Apple Pay button on iPhone

1. **Something added a script to the page.** WebKit turns Apple Pay off on any page the
   host app has added scripts to. If you wrapped the checkout in a web view of your own,
   remove every `injectedJavaScript`, `injectedJavaScriptBeforeContentLoaded` and
   `onMessage`. Use `GetPayInCheckoutView` as it is.
2. **The device has no card in Wallet**, or you are on a simulator without one.
3. **Apple Pay is not enabled on the GetPayIn company.** Ask support.

## No Google Pay button on Android

In the app's own screen (`googlePayInApp: true`):

1. **Google has not approved your app yet.** This is the usual answer. Set
   `googlePayInApp: false` until it has. Google Pay then works in the browser sheet with
   no approval. See [Google Pay on Android](google-pay.md).
2. **Android System WebView is older than 137**, or **Google Play services older than
   25.18.30**.
3. **Something overrode the user agent.** Google checks it and requires it to end with
   `GOOGLE_PAY_SUPPORTED`. Do not set `userAgent` on the web view.

In the browser sheet (`googlePayInApp: false`): the payer has no card in Google Pay, or the
sheet opened in a browser without Google Pay support.

## A blank white checkout screen

The page could not load. The provider shows the message and a Close button; if you render
`GetPayInCheckoutView` yourself, handle `onLoadError` or you get a blank screen with no way
out.

Check that the `checkoutUrl` your server returned is reachable from the device, and that
the link has not expired.

## `GetPayInProviderMissingError`

An in-app checkout was opened with no `<GetPayInProvider>` mounted above it. Mount it at
the root of the app. Note that iOS always uses the in-app screen, so an app that only ever
tested the Android browser sheet will hit this the first time it runs on an iPhone.

## `GetPayInSessionBusyError`

Another checkout is still open, almost always a double tap on Pay. Guard the button with
`GetPayInCheckout.busy`, or catch and ignore it.

## A real payment came back as `cancelled`

The browser sheet reported its own dismissal and no return link followed within the grace
period. Check that the return scheme matches in all three places, as above. Your server's
`invoice.paid` webhook is the authority here, and it will have fired.

## A result came back as `not_paid` with a message about a different invoice

`expectedInvoiceId` did its job: the return link named an invoice other than the one this
checkout was opened for. Either something forged the link, or your code passed the wrong
`expectedInvoiceId`. Check which invoice your server actually created.

## A 3-D Secure bank app does not open

The package opens the bank's link directly, with no scheme to declare. If nothing opens,
the bank's app is most likely not installed on that phone. The payer is shown
`linkErrorMessage` and the top bar appears so they can close the checkout; they can finish
the step on the bank's web page if it offers one.

On Android, some bank pages use `intent://` links, which a web view cannot follow the way
Chrome does. If a bank's step works in the browser sheet but not in your app's own screen,
please report it with the bank's name.

The package deliberately refuses some links rather than handing them to the phone:

1. Script schemes: `javascript:`, `vbscript:`.
2. Your own app's schemes, when the link is not the return link. That is every scheme your
   app answers to, not only the return link's. See [Security model](security.md).
3. Schemes with no part in paying: `market:`, `itms-apps:`, `itms-services:`, `sms:`,
   `smsto:`, `mms:`, `shortcuts:`, `content:`, `android-app:`.
4. Anything a frame inside the checkout page asks for, other than ordinary web content.

`tel:`, `mailto:` and `intent:` are allowed. If a legitimate flow needs one of the refused
ones, it is a bug, so please report it with the bank's name.

## Reporting a bug

Include the package version, the phone and OS version, whether it is a dev or store build,
which presentation was used (`GetPayInCheckout.presentationFor({})` tells you), and the
`CheckoutResult` you received. Never include real card numbers or live credentials.

For a suspected vulnerability, report privately. See [`SECURITY.md`](../SECURITY.md).
