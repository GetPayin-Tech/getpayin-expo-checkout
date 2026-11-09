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

| Option              | Type                    | Default             | What it does                                                                                                                                                     |
| ------------------- | ----------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `returnUrl`         | `string`                | required            | The link the checkout returns to. Must match the integration's Mobile App Return Scheme.                                                                         |
| `expectedInvoiceId` | `string`                | —                   | The invoice your server created this checkout for. A return link naming a different invoice is reported as `not_paid`. Pass it whenever you have it.             |
| `googlePayInApp`    | `boolean`               | `false`             | Draw the checkout in the app's own screen on Android. Set it only after Google approves your app. Ignored on iOS.                                                |
| `title`             | `string`                | `'Secure checkout'` | Title in the in-app screen's top bar.                                                                                                                            |
| `headerShown`       | `boolean`               | `true`              | Show the top bar, which is the payer's only way to close the checkout. The bar is shown anyway if the checkout fails to load, so a failure always has a way out. |
| `statusResolver`    | `StatusResolver`        | —                   | Reads the outcome off the return link when the built-in reader cannot.                                                                                           |
| `presentation`      | `'in-app' \| 'browser'` | —                   | Overrides the platform rule. For tests and for diagnosing a build.                                                                                               |

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
  expectedInvoiceId={string | undefined}
  statusResolver={StatusResolver | undefined}
  onComplete={(result: CheckoutResult) => void}
  onLoadError={(message: string) => void}
/>
```

The checkout itself, for a screen of your own navigation. `onComplete` fires once per
checkout; changing `checkoutUrl` starts a new one. Handle `onLoadError` — it also reports
an unusable `checkoutUrl`, which is passed to you rather than thrown, so a bad URL from
your server does not take the screen down.

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
  readonly message?: string;
  readonly returnUrl?: string;
}
```

A report of what the return link said — never proof of payment.

### `CheckoutStatus`

```ts
const CheckoutStatus = {
  Paid: 'paid',
  NotPaid: 'not_paid',
  Cancelled: 'cancelled',
} as const;
```

### `StatusResolver`

```ts
type StatusResolver = (
  params: Readonly<Record<string, string>>,
  url: string,
) => CheckoutResult | undefined;
```

Parameter names arrive lowercased with `-`, `_` and `.` removed. Return `undefined` to
fall back to the built-in reader.

### Other exported types

`CheckoutOptions`, `CheckoutPresentation`, `CheckoutPresenter`, `CheckoutRequest`,
`CheckoutStatusName`, `GetPayInCheckoutViewProps`, `GetPayInProviderProps`, `PlatformName`,
`ReturnUrlParams`, `ReturnResolution`, `NativeIntentEvent`.

## Errors

All extend `GetPayInCheckoutError`.

| Error                          | When                                                                 |
| ------------------------------ | -------------------------------------------------------------------- |
| `GetPayInConfigError`          | `checkoutUrl` is not an `http(s)` URL, or `returnUrl` has no scheme. |
| `GetPayInProviderMissingError` | An in-app checkout with no `<GetPayInProvider>` mounted above it.    |
| `GetPayInSessionBusyError`     | Another checkout is still open.                                      |

## Lower-level exports

These are the package's own decision-making, exported because they are useful for tests
and diagnostics. You do not need them for a normal integration.

| Export                                                          | What it does                                                             |
| --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `readCheckoutResult(url, statusResolver?)`                      | Turns a return link into a `CheckoutResult`.                             |
| `resolveReturn(url, { statusResolver?, expectedInvoiceId? })`   | The same, bound to an invoice. Both presentations use this.              |
| `matchesReturnUrl(url, returnUrl)`                              | True when `url` is the return link, whatever its query.                  |
| `resolvePresentation({ platform, googlePayInApp?, override? })` | The platform rule, as a pure function.                                   |
| `classifyNavigation(url, returnUrl)`                            | `'return' \| 'external' \| 'load' \| 'block'` for one navigation.        |
| `createNavigationHandler(options)`                              | The web view's navigation decision, for embedding the checkout yourself. |
| `buildCheckoutWebViewProps(platform)`                           | The web view settings the wallets need.                                  |
