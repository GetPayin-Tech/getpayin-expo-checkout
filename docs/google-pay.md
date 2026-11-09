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
app screen with no Google Pay button and no error explaining why — card still works, so it
looks like Google Pay is simply missing.

## Getting Google's approval

1. **Publish your app on Google Play.** The app must already be live under the same Google
   account you will apply with.
2. In the [Google Pay & Wallet Console](https://pay.google.com/business/console), open
   **Google Pay API → Integrations → Integrate with your Android app**, choose your app,
   and follow Google's form. It asks for screenshots of the Google Pay flow.
3. The form also asks for an integration type (Gateway or Direct) and gateway details. The
   Google Pay button on the checkout comes from CyberSource's payment box, so these values
   are ours to give you — **ask GetPayIn support rather than guessing**. A wrong value here
   is rejected late.
4. Click **Submit for approval** and wait for Google's reply.
5. When approved, set `googlePayInApp: true` and release a new build.

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

## Next

[Troubleshooting](troubleshooting.md) if a wallet button is missing.
