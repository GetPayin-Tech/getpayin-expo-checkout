import type { ReactNode } from 'react';

/**
 * The three outcomes a checkout can end in.
 *
 * `paid` and `not_paid` are what the return link reported; `cancelled` means the payer
 * closed the screen or the browser sheet without finishing.
 */
export const CheckoutStatus = {
  Paid: 'paid',
  NotPaid: 'not_paid',
  Cancelled: 'cancelled',
} as const;

/** Union of the {@link CheckoutStatus} values. */
export type CheckoutStatusName = (typeof CheckoutStatus)[keyof typeof CheckoutStatus];

/**
 * What a finished checkout hands back.
 *
 * This is a report of what the return link said, never proof of payment. Confirm the
 * `invoice.paid` webhook on your own server before you fulfil the order.
 */
export interface CheckoutResult {
  readonly status: CheckoutStatusName;
  readonly invoiceId?: string;
  readonly message?: string;
  readonly returnUrl?: string;
}

/**
 * Where the hosted checkout is drawn.
 *
 * `in-app` is a full-screen web view inside the app, `browser` is the phone's browser
 * sheet (Chrome Custom Tabs on Android, an authentication session on iOS).
 */
export type CheckoutPresentation = 'in-app' | 'browser';

/** The platforms the presentation rule distinguishes between. */
export type PlatformName = 'ios' | 'android' | string;

/** Options shared by every way of presenting a checkout. */
export interface CheckoutOptions {
  /**
   * The link the checkout sends the payer back to, for example `myapp://payment-return`.
   * It has to match the **Mobile App Return Scheme** on the GetPayIn integration.
   */
  readonly returnUrl: string;

  /**
   * Draw the checkout in the app's own screen on Android, which only offers Google Pay
   * after Google has approved the app. Leave it off until then, so Android payers get
   * the browser sheet where Google Pay needs no approval. Ignored on iOS, which always
   * uses the app's own screen.
   *
   * @defaultValue false
   */
  readonly googlePayInApp?: boolean;

  /**
   * The invoice this checkout is for, as your server reported it alongside the
   * `checkout_url`.
   *
   * Supply it whenever you have it. The return link is a public app scheme that any web
   * page, message or other app on the phone can invoke with whatever query it likes, so a
   * link naming a different invoice is not this checkout's result. With this set, such a
   * link is reported as `not_paid` instead of being taken at its word.
   *
   * A number is accepted as well as text: `POST /api/integration/init` and the
   * `@getpayin/getpayin` server SDK both return the invoice id as a number, while the
   * return link carries it as text. The two are compared as text.
   *
   * Leave it out when you have no invoice id. `null`, an empty value or anything that is
   * not text or a number is refused with `GetPayInConfigError`, because taken as "not
   * given" it would accept a paid link for any invoice. A field missing from your server's
   * response arrives as `undefined`, which looks exactly like leaving the option out and
   * turns the check off — make sure your server always sends the invoice id.
   */
  readonly expectedInvoiceId?: string | number;

  /** Overrides the presentation rule. Intended for tests and for diagnosing a build. */
  readonly presentation?: CheckoutPresentation;

  /**
   * The text shown to the payer when the checkout page cannot be loaded, in your app's
   * language.
   *
   * @defaultValue 'The checkout could not be loaded. Check the connection and try again.'
   */
  readonly loadErrorMessage?: string;
}

/** Options for {@link GetPayInCheckout.open}. */
export interface OpenCheckoutOptions extends CheckoutOptions {
  /** Title shown in the in-app screen's top bar. */
  readonly title?: string;

  /**
   * The label of the in-app screen's close button, in your app's language. When set, it
   * is also what a screen reader announces for the button (otherwise "Close checkout").
   *
   * @defaultValue 'Close'
   */
  readonly closeLabel?: string;

  /**
   * Show the in-app screen's top bar, which is the payer's only way to close the
   * checkout.
   *
   * @defaultValue true
   */
  readonly headerShown?: boolean;
}

/** A checkout the provider has been asked to present. */
export interface CheckoutRequest {
  readonly checkoutUrl: string;
  readonly options: OpenCheckoutOptions;
}

/** Presents a checkout and settles once it ends. */
export type CheckoutPresenter = (request: CheckoutRequest) => Promise<CheckoutResult>;

/** Props for {@link GetPayInProvider}. */
export interface GetPayInProviderProps {
  readonly children?: ReactNode;
}

/** Props for {@link GetPayInCheckoutView}. */
export interface GetPayInCheckoutViewProps extends CheckoutOptions {
  /** The `checkout_url` your server returned. Pass it in memory, never through a route. */
  readonly checkoutUrl: string;

  /** Called once, with the outcome, when the checkout ends. */
  readonly onComplete: (result: CheckoutResult) => void;

  /** Called when loading the checkout itself fails. */
  readonly onLoadError?: (message: string) => void;
}
