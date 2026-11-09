# Taking payments

## The flow

```text
your app  ──▶  your server  ──▶  GetPayIn        creates the payment, returns checkout_url
your app  ◀──  your server                       checkout_url + invoiceId
your app  ──▶  this package                      opens the checkout, payer pays
your app  ◀──  this package                      { status, invoiceId, message }
your app  ──▶  your server                       confirm before you deliver anything
          ◀──  GetPayIn                          invoice.paid webhook — the real answer
```

Your server is the only place that knows whether a payment happened. The app's result is a
report of what the return link said.

## Opening a checkout

```tsx
import { GetPayInCheckout } from '@getpayin/expo-checkout';

async function pay(order) {
  const { checkoutUrl, invoiceId } = await myApi.createPayment(order);

  const result = await GetPayInCheckout.open(checkoutUrl, {
    returnUrl: 'myapp://payment-return',
    expectedInvoiceId: invoiceId,
    googlePayInApp: false,
  });

  switch (result.status) {
    case 'paid':
      await myApi.confirmPayment(result.invoiceId);
      break;
    case 'not_paid':
      // A code means the package refused the link, not that the card was declined: the
      // payer may have paid, so check the invoice rather than asking them to pay again.
      if (result.code) {
        await myApi.checkInvoice(invoiceId);
      }
      showMessage(result.message ?? 'The payment did not go through.');
      break;
    case 'cancelled':
      break;
  }
}
```

Pass `checkoutUrl` **in memory**. A navigation parameter decodes it twice and the checkout
answers HTTP 403.

## The result

| `status`    | What it means                                                                     | What to do                            |
| ----------- | --------------------------------------------------------------------------------- | ------------------------------------- |
| `paid`      | The return link said the payment went through.                                    | Confirm on your server, then deliver. |
| `not_paid`  | Declined, failed, or a return link that could not be trusted. `message` says why. | Show `message`. See `code` below.     |
| `cancelled` | The payer closed the checkout or the browser sheet.                               | Nothing. Leave the cart as it was.    |

`cancelled` only ever comes from the payer closing the screen. A hosted checkout the payer
abandons and returns from reports `not_paid`.

`invoiceId` is present when the return link carried one. `invoiceStatus` is the invoice
state the link reported (`PAID`, `UNPAID`, `PARTIALLY_PAID`, `AUTHORIZED`), and only `PAID`
is reported as `paid`. `returnUrl` is the raw link the result came from, which is useful in
a bug report.

### `code` on a `not_paid`

A `not_paid` the package decided for itself carries a `code`; a genuine decline carries
none. It is the stable value to branch on and to look a message of your own up by, where
`message` is text for the payer and changes with your app's language.

| `code`                      | What happened                                           | What to do                                                           |
| --------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| absent                      | The checkout declined or failed the payment.            | Show `message`. Offer a retry.                                       |
| `unreadable_return_link`    | The link's own fields could not be read.                | Check the invoice on your server. Alert on this one — it is a bug.   |
| `wrong_invoice`             | The link named another invoice.                         | Check the invoice on your server. Do not retry blindly.              |
| `unexpected_invoice_status` | `success=1` with an `invoice_status` other than `PAID`. | Check the invoice on your server. An authorised invoice is not paid. |

The payer may well have paid in all three of those, so none of them is a reason to ask for
payment again before the invoice has been checked on your server.

## Confirming it

`status: 'paid'` is a claim, not an authorisation. Your return scheme is public — it is in
your `Info.plist` and your `AndroidManifest.xml` — so any web page, message, QR code or
other app on the phone can open your app with
`myapp://payment-return?success=1&invoice_id=anything`.

Confirm with the `invoice.paid` webhook on your server before you deliver.
[`@getpayin/getpayin`](https://www.npmjs.com/package/@getpayin/getpayin) checks webhook
signatures for you:

```ts
const event = getpayin.webhooks.verify(rawBody, signatureHeader);

if (event.event === 'invoice.paid') {
  await fulfil(event.data.invoiceId);
}
```

See [the security model](security.md) for what the package does on its side.

## Errors

Every failure arrives as a rejection, so one `catch` covers them all:

```tsx
try {
  const result = await GetPayInCheckout.open(checkoutUrl, options);
} catch (error) {
  if (error instanceof GetPayInSessionBusyError) {
    return; // a double tap on Pay — ignore it
  }

  throw error;
}
```

| Error                          | Cause                                                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `GetPayInConfigError`          | `checkoutUrl` is not an http(s) URL, `returnUrl` has no scheme, or `expectedInvoiceId` is `null`, empty, or not text or a number. |
| `GetPayInProviderMissingError` | An in-app checkout with no `<GetPayInProvider>` mounted.                                                                          |
| `GetPayInSessionBusyError`     | Another checkout is still open. Usually a double tap.                                                                             |

A double tap on Pay is the common one. Either guard the button with
`GetPayInCheckout.busy`, or catch and ignore `GetPayInSessionBusyError` as above.

One mistake the package cannot catch: if your server's response leaves the invoice id out
altogether, it arrives as `undefined`, which is the same as not passing `expectedInvoiceId`,
and the invoice check is off. Make your server always send it, or check for it before you
call `open()`.

## Retrying

After a `not_paid`, create a **new** payment on your server and open the new
`checkoutUrl`. Do not reopen the old one: a checkout link is for one attempt, and its
invoice is already in a terminal state.

```tsx
async function retry(order) {
  const { checkoutUrl, invoiceId } = await myApi.createPayment(order);

  return GetPayInCheckout.open(checkoutUrl, {
    returnUrl: 'myapp://payment-return',
    expectedInvoiceId: invoiceId,
  });
}
```

## Where the checkout is drawn

You do not choose this per call; the platform does, with one setting for Android:

| Platform | `googlePayInApp`  | Where it opens            |
| -------- | ----------------- | ------------------------- |
| iOS      | anything          | Your app's own screen     |
| Android  | `false` (default) | The phone's browser sheet |
| Android  | `true`            | Your app's own screen     |

Keep `googlePayInApp: false` until Google has approved your app — see
[Google Pay on Android](google-pay.md). To show the payer which one a build will use:

```tsx
GetPayInCheckout.presentationFor({ googlePayInApp: false }); // 'in-app' | 'browser'
```

## Using your own screen

`open()` draws the checkout in the provider's modal. To put it in a screen of your own
navigation instead, render the view directly:

```tsx
import { GetPayInCheckoutView } from '@getpayin/expo-checkout';

function CheckoutScreen({ route, navigation }) {
  return (
    <GetPayInCheckoutView
      checkoutUrl={route.params.checkoutUrl}
      returnUrl="myapp://payment-return"
      expectedInvoiceId={route.params.invoiceId}
      onComplete={(result) => {
        navigation.replace(result.status === 'paid' ? 'ThankYou' : 'Cart');
      }}
      onLoadError={(message) => showMessage(message)}
    />
  );
}
```

Two things to know when you do this:

1. **Handle `onLoadError`.** The provider shows a message and a Close button when the
   checkout cannot load. Your own screen has to do that itself, or a failed load is a
   blank screen with no way out.
2. **Give the payer a way to cancel.** The provider's top bar does this. In your own
   screen it is your header or back button, and you decide what a cancel means.

`onComplete` fires once per checkout. Changing `checkoutUrl` starts a new one.

## What the result is read from

GetPayIn's return link carries `success`, `invoice_id`, `invoice_status`, `message` and
`signature`. The package reads four of them:

1. `success`: `1` is `paid` and `0` is `not_paid`. Any other value, or no value, is
   `not_paid` with `code: 'unreadable_return_link'`.
2. `invoice_id` becomes `invoiceId`.
3. `invoice_status` becomes `invoiceStatus`. A `paid` carrying anything but `PAID` is
   reported as `not_paid` with `code: 'unexpected_invoice_status'`.
4. `message` becomes `message`.

Names must match exactly, values are taken as sent, and the link is reported as
`not_paid` with `code: 'unreadable_return_link'` when it repeats **any** field or carries a
name only a looser reader would take for one of those four — `Success`, `invoiceId`,
`%73uccess`. Nothing else on the link is read, so a field GetPayIn does not send, such as
`status=paid`, cannot change the outcome. A forged link can still say `success=1`, which is
why your server confirms the payment.

The whole link stays in `returnUrl`, so your server can check its `signature`. If it does,
read the values from the link the same strict way: exact names, no case folding, no
decoding of names, and refuse a field that appears twice — `signature` included. A looser
reader could take a different `invoice_id` from the one the signature covers, and accept a
genuine link for one invoice as payment for another.

A valid signature is still not enough on its own. The signature covers `success`,
`invoice_id`, `invoice_status` and `message` joined with no separator, so a genuine link
for invoice 4512 with status `PAID` also checks out as invoice 451 with status `2PAID`.
Before you trust it, also require `invoice_id` to be digits only and `invoice_status` to be
one of GetPayIn's statuses (`PAID`, `UNPAID`, `PARTIALLY_PAID`, `AUTHORIZED`, …), and that
`invoice_id` is the invoice you created for this order. The `invoice.paid` webhook goes
from GetPayIn straight to your server and never passes through the phone, which is why it
is the one to fulfil orders on.

## Next

[API reference](api.md) · [Troubleshooting](troubleshooting.md)
