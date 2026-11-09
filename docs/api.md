# API reference

Everything the package exports. Types are shipped with the package, so your editor has all
of this too.

## `GetPayInCheckout.open(checkoutUrl, options)`

```ts
open(checkoutUrl: string, options: OpenCheckoutOptions): Promise<CheckoutResult>
```

Presents the checkout and resolves once it ends. `checkoutUrl` is the `checkout_url` your
server received from `POST /api/integration/init`; it must be an `http(s)` URL and must be
passed in memory rather than through a navigation parameter.

Every failure arrives as a rejection, so one `catch` covers them all.

### `OpenCheckoutOptions`

| Option              | Type                    | Default             | What it does                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------- | ----------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `returnUrl`         | `string`                | required            | The link the checkout returns to. Must match the integration's Mobile App Return Scheme.                                                                                                                                                                                                                                                                                          |
| `expectedInvoiceId` | `string \| number`      | none                | The invoice your server created this checkout for, as init returned it (a number is fine). Compared as trimmed text, leading zeros ignored. A return link naming a different invoice is reported as `not_paid`. Pass it whenever you have it; leave it out rather than passing `null`, `''` or a number that is not a safe integer, which are refused with `GetPayInConfigError`. |
| `googlePayInApp`    | `boolean`               | `false`             | Draw the checkout in the app's own screen on Android. Set it only after Google approves your app. Ignored on iOS.                                                                                                                                                                                                                                                                 |
| `title`             | `string`                | `'Secure checkout'` | Title in the in-app screen's top bar.                                                                                                                                                                                                                                                                                                                                             |
| `closeLabel`        | `string`                | `'Close'`           | Label of the top bar's close button, in your app's language. Also what a screen reader announces when set.                                                                                                                                                                                                                                                                        |
| `loadErrorMessage`  | `string`                | English text        | Shown to the payer when the checkout page cannot be loaded, in your app's language.                                                                                                                                                                                                                                                                                               |
| `linkErrorMessage`  | `string`                | English text        | Shown to the payer when the phone cannot open a link the checkout needed, such as a bank app for 3-D Secure that is not installed.                                                                                                                                                                                                                                                |
| `headerShown`       | `boolean`               | `true`              | Show the top bar, which is the payer's only way to close the checkout. The bar is shown anyway if the checkout fails to load, so a failure always has a way out.                                                                                                                                                                                                                  |
| `presentation`      | `'in-app' \| 'browser'` | none                | Overrides the platform rule. For tests and for diagnosing a build.                                                                                                                                                                                                                                                                                                                |

## `GetPayInCheckout.presentationFor(options)`

```ts
presentationFor(options: Pick<OpenCheckoutOptions, 'googlePayInApp' | 'presentation'>): CheckoutPresentation
```

Returns `'in-app'` or `'browser'` for this phone and these options without opening
anything. Useful on a diagnostic screen.

## `GetPayInCheckout.busy`

```ts
readonly busy: boolean
```

True while a checkout is open. Guard your Pay button with it to avoid
`GetPayInSessionBusyError` on a double tap.

## `GetPayInProvider`

```tsx
<GetPayInProvider>{children}</GetPayInProvider>
```

Hosts the in-app checkout screen. Mount it once at the root of the app, above the
navigation. `open()` needs it to present an in-app checkout.

## `GetPayInCheckoutView`

```tsx
<GetPayInCheckoutView
  checkoutUrl={string}
  returnUrl={string}
  expectedInvoiceId={string | number | undefined}
  loadErrorMessage={string | undefined}
  linkErrorMessage={string | undefined}
  onComplete={(result: CheckoutResult) => void}
  onLoadError={(message: string, detail?: string) => void}
/>
```

The checkout itself, for a screen of your own navigation. `onComplete` fires once per
checkout; changing `checkoutUrl` starts a new one. Handle `onLoadError`: it also reports
an unusable `checkoutUrl`, `returnUrl` or `expectedInvoiceId`, which is passed to you
rather than thrown, so a bad value from your server does not take the screen down.

`onLoadError`'s first argument is for the payer, already in your app's language. The second
is the developer-facing cause when there is one, naming the option and the value it got:
log it, and never put it on a payment screen.

Do not add `injectedJavaScript`, `onMessage` or any other script to this view or to a web
view of your own around it.

## `createPaymentReturnRedirect(returnUrl, initialPath?)`

```ts
createPaymentReturnRedirect(
  returnUrl: string,
  initialPath?: string,
): (event: NativeIntentEvent) => string | null
```

Builds the `redirectSystemPath` an expo-router app exports from `app/+native-intent.tsx`.
`initialPath` defaults to `'/'`. Matching is on whole path segments.

## Types

### `CheckoutResult`

```ts
interface CheckoutResult {
  readonly status: 'paid' | 'not_paid' | 'cancelled';
  readonly invoiceId?: string;
  readonly invoiceStatus?: string;
  readonly code?: 'unreadable_return_link' | 'wrong_invoice' | 'unexpected_invoice_status';
  readonly message?: string;
  readonly returnUrl?: string;
}
```

A report of what the return link said, never proof of payment.

`invoiceStatus` is the invoice state the link reported, as GetPayIn wrote it: `PAID`,
`UNPAID`, `PARTIALLY_PAID`, `AUTHORIZED`. Only `PAID` is reported as `paid`.

### `CheckoutStatus`

```ts
const CheckoutStatus = {
  Paid: 'paid',
  NotPaid: 'not_paid',
  Cancelled: 'cancelled',
} as const;
```

### `CheckoutResultCode`

```ts
const CheckoutResultCode = {
  UnreadableReturnLink: 'unreadable_return_link',
  WrongInvoice: 'wrong_invoice',
  UnexpectedInvoiceStatus: 'unexpected_invoice_status',
} as const;
```

Why a checkout was not reported as paid, when the reason is worth acting on. `message` is
text for the payer and changes with your app's language; this is the stable value to branch
on, and the key to look a message of your own up by.

| Code                        | What happened                                                                                               |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `unreadable_return_link`    | The link's own fields could not be read. Alert on it: the backend and this reader disagree about the shape. |
| `wrong_invoice`             | The link named an invoice other than the one the checkout was opened for.                                   |
| `unexpected_invoice_status` | The link reported `paid` with an `invoice_status` other than `PAID`.                                        |

A genuine decline carries no code at all, which is how it is told apart from a link that
could not be read. The payer may well have paid in all three cases, so none of them is a
reason to ask for payment again before the invoice has been checked on your server.

### Other exported types

`CheckoutOptions`, `CheckoutPresentation`, `CheckoutPresenter`, `CheckoutRequest`,
`CheckoutResultCodeName`, `CheckoutStatusName`, `GetPayInCheckoutViewProps`,
`GetPayInProviderProps`, `NavigationContext`, `NavigationRequest`, `PlatformName`,
`ReturnResolution`, `NativeIntentEvent`.

## Errors

All extend `GetPayInCheckoutError`.

| Error                          | When                                                                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `GetPayInConfigError`          | `checkoutUrl` is not an `http(s)` URL, `returnUrl` has no scheme, or `expectedInvoiceId` is `null`, empty or not a safe integer. |
| `GetPayInProviderMissingError` | An in-app checkout with no `<GetPayInProvider>` mounted above it.                                                                |
| `GetPayInSessionBusyError`     | Another checkout is still open.                                                                                                  |

## Lower-level exports

These are the package's own decision-making, exported because they are useful for tests
and diagnostics. You do not need them for a normal integration.

| Export                                                          | What it does                                                                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `readCheckoutResult(url)`                                       | Turns GetPayIn's return link (`success`, `invoice_id`, `invoice_status`, `message`) into a `CheckoutResult`. |
| `resolveReturn(url, { expectedInvoiceId? })`                    | The same, bound to an invoice. Both presentations use this.                                                  |
| `matchesReturnUrl(url, returnUrl)`                              | True when `url` is the return link, whatever its query.                                                      |
| `resolvePresentation({ platform, googlePayInApp?, override? })` | The platform rule, as a pure function.                                                                       |
| `classifyNavigation(url, context)`                              | `'return' \| 'external' \| 'load' \| 'block'` for one navigation.                                            |
| `createNavigationHandler(options)`                              | The web view's navigation decision, for embedding the checkout yourself.                                     |
| `hostAppSchemes()`                                              | Every URL scheme the host app answers to, read from its Expo app config.                                     |
| `schemesFromAppConfig(config)`                                  | The same rule over a config you hand it, for an app that holds its own.                                      |
| `buildCheckoutWebViewProps(platform)`                           | The web view settings the wallets need.                                                                      |

### Embedding the checkout in a web view of your own

`classifyNavigation` and `createNavigationHandler` both need the full picture of what the
app answers to, so neither has a default for it:

```ts
classifyNavigation(url, {
  returnUrl: 'myapp://payment-return',
  ownSchemes: hostAppSchemes(),
  isTopFrame: request.isTopFrame,
});

const handler = createNavigationHandler({
  returnUrl: 'myapp://payment-return',
  ownSchemes: hostAppSchemes(),
  expectedInvoiceId: init.invoice_id,
  onComplete: setResult,
  onExternal: (url) => Linking.openURL(url).catch(reportFailure),
});

handler({ url: request.url, isTopFrame: request.isTopFrame });
```

`ownSchemes` is every other scheme the app answers to, and it is required: without it only
the return link's own scheme is refused, and a page inside the checkout could reach the
app's other deep-link routes. `hostAppSchemes()` reads them from the Expo app config.

`isTopFrame` says whether the page itself asked for the navigation, and it is required for
the same reason. `react-native-webview` reports it on the request. A navigation from a
frame inside the page can only ever load ordinary web content: a 3-D Secure page is hosted
by the issuer and knows the real invoice id, so an `<iframe>` pointing itself at the return
link would otherwise end the checkout as `paid` with nothing paid.
