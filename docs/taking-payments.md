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
| `not_paid`  | Declined, failed, or a return link that could not be trusted. `message` says why. | Show `message`. Offer a retry.        |
| `cancelled` | The payer closed the checkout or the browser sheet.                               | Nothing. Leave the cart as it was.    |

`invoiceId` is present when the return link carried one. `returnUrl` is the raw link the
result came from, which is useful in a bug report.

## Confirming it

`status: 'paid'` is a claim, not an authorisation. Your return scheme is public — it is in
your `Info.plist` and your `AndroidManifest.xml` — so any web page, message, QR code or
other app on the phone can open your app with
`myapp://payment-return?status=paid&invoice_id=anything`.

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

| Error                          | Cause                                                              |
| ------------------------------ | ------------------------------------------------------------------ |
| `GetPayInConfigError`          | `checkoutUrl` is not an http(s) URL, or `returnUrl` has no scheme. |
| `GetPayInProviderMissingError` | An in-app checkout with no `<GetPayInProvider>` mounted.           |
| `GetPayInSessionBusyError`     | Another checkout is still open. Usually a double tap.              |

A double tap on Pay is the common one. Either guard the button with
`GetPayInCheckout.busy`, or catch and ignore `GetPayInSessionBusyError` as above.

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

## Reading a different return link

The built-in reader accepts the common spellings of the status, invoice and message
parameters (`status`, `paid_status`, `paymentStatus`, `success`, `invoice_id`, `invoiceId`,
`message`, `error`, and more), in any case and with either separator. If your integration
reports its outcome under a name it does not know, supply a resolver instead of forking:

```tsx
const result = await GetPayInCheckout.open(checkoutUrl, {
  returnUrl: 'myapp://payment-return',
  statusResolver: (params) =>
    params.outcome === 'settled' ? { status: 'paid', invoiceId: params.ref } : undefined,
});
```

Return `undefined` to fall back to the built-in reader. Parameter names reach the resolver
lowercased and with `-`, `_` and `.` removed, so `Invoice_Id` arrives as `invoiceid`.
`expectedInvoiceId` is still enforced on whatever the resolver returns.

## Next

[API reference](api.md) · [Troubleshooting](troubleshooting.md)
