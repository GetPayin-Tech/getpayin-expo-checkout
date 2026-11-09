# Security model

What the package guarantees, what it cannot, and where your server has to take over. To
report a vulnerability, see [`SECURITY.md`](../SECURITY.md).

## What never enters the app

1. **No signing secret.** Your hash token belongs on your server, which signs
   `POST /api/integration/init` and hands the app only a `checkout_url`. The package
   contains no HMAC, no `node:crypto` and no reference to a hash token; the build fails if
   any of those ever appear in the shipped bundle.
2. **No card details.** The payer enters them on the hosted checkout, inside CyberSource's
   own frames. The package adds no script to that page, so it has no way to read them even
   in principle.
3. **No storage.** The package persists nothing.

## The return link is attacker-controllable

This is the important one.

Your app's return scheme is declared in your `Info.plist` and your `AndroidManifest.xml`.
It is public. **Anything on the phone can open your app with it**: a link in a web page,
an SMS, a QR code, or `startActivity` from any other installed app, carrying whatever
query it likes:

```text
myapp://payment-return?success=1&invoice_id=whatever-the-attacker-wants
```

So `status: 'paid'` means "the link said so", not "the money moved".

### What the package does about it

1. **An unreadable status is never upgraded.** A link whose status the reader does not
   recognise becomes `not_paid`, with a message saying so. No code path turns absent or
   unknown input into `paid`.
2. **The launch link never settles a later checkout.** `getInitialURL()` keeps returning
   the link that started the app for the whole life of the process. A forged link that
   cold-starts your app is taken out of circulation before any checkout can read it, so it
   cannot become the result of the next payment the payer starts. Values pulled from
   `getInitialURL()` are consumed once per process for the same reason; links pushed by the
   `url` event are not, because the system delivers each of those once as it happens.
3. **`expectedInvoiceId` binds the link to the checkout.** With it set, a `paid` link
   naming a different invoice, or naming none at all, is reported as `not_paid`. **Pass
   it whenever you have it.** Without it the package has nothing to tie the link to.
4. **One checkout at a time**, so a second cannot be stacked over a live one.
5. **A result is delivered once.** The return link can arrive from a web view navigation, a
   deep-link event and a recreated activity at the same moment; every settle after the
   first is dropped, so one payment cannot be reported twice.

### What your server must do

Confirm the `invoice.paid` webhook before you deliver anything. None of the above is a
substitute. [`@getpayin/getpayin`](https://www.npmjs.com/package/@getpayin/getpayin)
verifies webhook signatures for you.

Treat the client result as a cue for what to show the payer, never as the authority for
what they are owed.

## The web view

`originWhitelist` is `['*']`, so the view is handed your return link itself. With the
default list the web view gives that link to the phone instead, and your result screen
opens on top of a checkout that has already been paid.

That means every navigation goes through the package's own handler, which sorts them into
four outcomes:

| Outcome    | What happens           | Examples                                                         |
| ---------- | ---------------------- | ---------------------------------------------------------------- |
| `return`   | The checkout ends.     | your return link, from the page itself                           |
| `load`     | Stays in the web view. | `https:`, `http:`, `about:`, `data:`, `blob:`, `file:`           |
| `external` | Handed to the phone.   | a bank app for 3-D Secure, `tel:`, `mailto:`, `intent:`          |
| `block`    | Refused.               | `javascript:`, your own app's scheme, `market:`, `sms:`, a frame |

Three of those deserve explanation.

**Why `external` exists, and why it is narrowed.** A 3-D Secure step can hand the payer to
their bank's app, and every acquirer has a different set of bank schemes, so this cannot be
an allow-list inside the package. It is narrowed in three ways instead:

1. Script schemes (`javascript:`, `vbscript:`) are refused.
2. **Every scheme your own app answers to is refused whenever it is not the return link**:
   the schemes in your app config, an Android intent filter's or `CFBundleURLTypes`'
   schemes, the iOS bundle identifier, the Android package name and the development-build
   scheme. So a page cannot drive your app's deep-link routes.
3. Schemes with no part in paying for anything are refused even though another app may
   answer to them: `market:`, `itms-apps:`, `itms-services:`, `sms:`, `smsto:`, `mms:`,
   `shortcuts:`, `content:` and `android-app:`. A browser would refuse most of these from
   the same page, and the link here is opened with no confirmation of any kind.

Anything else is opened with `openURL` directly.

That is a trade-off. Asking `canOpenURL` first would limit pages to the schemes your app
has declared. In practice that is none, so a bank-app step would never open. Without it, a page
inside the checkout can open another installed app without a tap, which is exactly what a
bank-app step needs. A link nothing on the phone can open is reported through
`onLoadError`, so the payer is told why the step did nothing and still has a way out.

**Why a frame inside the page gets less.** A navigation the page did not ask for itself can
only ever `load` ordinary web content. It never ends the checkout and never reaches another
app. A 3-D Secure page knows the real invoice id, so an `<iframe>` pointing itself at
`myapp://payment-return?success=1&invoice_id=<the real one>` would otherwise report a
payment that was never made, and `expectedInvoiceId` would not catch it, because the
invoice id is genuine.

The reason this matters: a 3-D Secure page is hosted by the **issuer**, not by GetPayIn.
The page driving these navigations is not one this package controls.

**Why nothing is injected.** WebKit turns Apple Pay off on any page the host app has added
scripts to. So there is no `injectedJavaScript`, no `injectedJavaScriptBeforeContentLoaded`
and no `onMessage` anywhere, not even for diagnostics, and not on Android either. The
build fails if one appears.

## Reading the return link

The link is read by exact field name (`success`, `invoice_id`, `invoice_status`,
`message`), and the values are taken as sent. A link is refused outright when it repeats
any field, or carries a name only a looser reader would take for one of those four
(`Success`, `invoiceId`, `%73uccess`).

That keeps this reader and a server checking the link's `signature` from ever reading
different values out of one link. A reader that folded case or took the first copy of a
field could report invoice B as paid from a link whose signature is genuine for invoice A:
`?invoiceId=5001&success=1&invoice_id=4000` is a real signed link for 4000 that a looser
reader calls 5001.

A refused link is `not_paid` with `code: 'unreadable_return_link'`. A genuine decline
carries no code, which is how the two are told apart. The link's own message would not,
because GetPayIn always sends one.

## What is out of scope

1. **Forging the exact return link.** An attacker who opens your app with a correctly
   shaped link naming the right invoice at the right moment can make the app _display_ a
   success. They cannot make your server believe it. This is why the webhook check is not
   optional.
2. **A compromised device.** Root, a malicious keyboard, screen recording. Nothing a
   payment SDK does survives that.
3. **Your own deep-link routes.** The package refuses to hand your scheme back to the OS
   from the checkout, but your app's routes should validate their own input regardless.

## Checklist

- [ ] The hash token is on your server only: not in the app, not in version control, not
      in any client-side config.
- [ ] Your server confirms `invoice.paid` before fulfilling.
- [ ] `expectedInvoiceId` is passed on every `open()` call.
- [ ] The Mobile App Return Scheme is specific to your app.
- [ ] You use a development or store build, not Expo Go.
- [ ] You have added no scripts to the checkout view.
