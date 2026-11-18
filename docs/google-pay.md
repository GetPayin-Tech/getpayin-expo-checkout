# Google Pay on Android

Google allows Google Pay inside an app's own screen only after it has approved that app.
Until then the same checkout opens in the phone's browser sheet, where Google Pay works
with no approval at all.

That is the whole reason `googlePayInApp` exists. It is one setting, and the package does
not try to detect the approval for you.

| `googlePayInApp`  | Where the checkout opens  | Google Pay | Needs approval |
| ----------------- | ------------------------- | ---------- | -------------- |
| `false` (default) | The phone's browser sheet | Yes        | No             |
| `true`            | Your app's own screen     | Yes        | Yes            |

Set it to `true` only once Google has replied. Set it too early and Android payers get an
app screen with no Google Pay button and no error explaining why. Card still works, so it
looks like Google Pay is simply missing.

## Getting Google's approval

1. **Publish your app on Google Play.** The Google Pay & Wallet Console lists only the apps
   published on Google Play under the Google account you sign in with.
2. In the [Google Pay & Wallet Console](https://pay.google.com/business/console), open
   **Google Pay API → Integrations** and find your app. If it is not listed, add the owner
   or an admin of your Google Play account under **Users**, then sign out and sign in again.
3. Next to **Complete your integration details and add screenshots of your buyflow**, click
   **Add**.
4. For the integration type, choose **Gateway**. Google Pay on the checkout runs through
   CyberSource, GetPayIn's payment gateway. That is the only question about the gateway:
   there is no gateway name or merchant ID to enter. **Direct** is for merchants that
   handle card numbers themselves.
5. Upload the five screenshots described below.
6. Under **Review integration checklist and submit**, click **Submit** and wait for Google's
   reply.
7. When approved, set `googlePayInApp: true` and release a new build.

### The screenshots

Take them from a test build of your app with `googlePayInApp: true`. It does not need to be
on Google Play. Google asks for screenshots of a test integration, so ask GetPayIn support
for a test checkout and no real payment is made.

| Google's step                 | What to show                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Item selection                | The product or service the payer picks.                                                                                              |
| Pre-purchase screen           | Your summary screen, with the button that starts the payment.                                                                        |
| Payment method screen         | The checkout in your app's own screen, with the Google Pay button.                                                                   |
| Google Pay API payment screen | The Google Pay sheet. Android blocks screenshots of it, so take a photo with another phone. Google also accepts a photo of an error. |
| Post-purchase screen          | Your success screen. Do not show the full card number.                                                                               |

The Google Pay button is drawn by the checkout, so there is nothing of Google's to restyle.
Where your own screens name it, keep "Google Pay" in English.

## Device requirements

Google Pay inside the app's own screen also needs, on the payer's phone:

- Android System WebView **137** or later
- Google Play services **25.18.30** or later

On older phones the Google Pay button does not appear and card still works. There is no
error, so if a tester reports a missing button, check these two versions first.

The browser sheet has no such requirement, which is another reason to leave
`googlePayInApp` off until you have to turn it on.

## Why not on iPhone

Google only offers Google Pay in Safari, not inside apps, and this package does not send
iPhone payers out to Safari for it. iPhone gets Apple Pay and card, in your app's own
screen.

## Google's own guides

- [Google Pay in Android WebView](https://developers.google.com/pay/api/android/guides/recipes/using-android-webview)
- [Publish your integration](https://developers.google.com/pay/api/android/guides/test-and-deploy/publish-your-integration)
- [Brand guidelines](https://developers.google.com/pay/api/android/guides/brand-guidelines)

## Next

[Troubleshooting](troubleshooting.md) if a wallet button is missing.
