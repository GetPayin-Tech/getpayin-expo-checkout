import { Platform } from 'react-native';

import { resolvePresentation } from './core/presentation';
import { SessionGuard } from './core/sessionGuard';
import { assertCheckoutUrl, assertReturnUrl } from './core/validate';
import { GetPayInProviderMissingError } from './errors';
import { runBrowserCheckout } from './sessions/browserSession';
import { getPresenter } from './sessions/registry';
import type {
  CheckoutPresentation,
  CheckoutRequest,
  CheckoutResult,
  OpenCheckoutOptions,
} from './types';

const guard = new SessionGuard();

/** Hands the request to the mounted provider. */
async function runInAppCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
  const presenter = getPresenter();

  if (presenter === undefined) {
    throw new GetPayInProviderMissingError();
  }

  return presenter(request);
}

/**
 * Opens the hosted GetPayIn checkout and waits for the payer to finish.
 *
 * Pass the `checkout_url` your server received from `POST /api/integration/init`. Nothing
 * here signs anything and the package never sees your hash token, so the URL has to
 * arrive already signed from your own server.
 */
export const GetPayInCheckout = {
  /**
   * Presents `checkoutUrl` and resolves once the checkout ends.
   *
   * The result reports what the return link said. It is not proof of payment — anyone can
   * open an app with a made-up return link — so confirm the `invoice.paid` webhook on your
   * server before you deliver the order.
   *
   * @throws {GetPayInConfigError} when `checkoutUrl` or `options.returnUrl` is unusable.
   * @throws {GetPayInProviderMissingError} when an in-app checkout has no provider mounted.
   * @throws {GetPayInSessionBusyError} when another checkout is still open.
   *
   * Every failure arrives as a rejection, including a bad `checkoutUrl`, so one
   * `catch` covers them all.
   */
  async open(checkoutUrl: string, options: OpenCheckoutOptions): Promise<CheckoutResult> {
    const request: CheckoutRequest = {
      checkoutUrl: assertCheckoutUrl(checkoutUrl),
      options: { ...options, returnUrl: assertReturnUrl(options.returnUrl) },
    };

    const presentation = GetPayInCheckout.presentationFor(options);

    return guard.run(() =>
      presentation === 'in-app' ? runInAppCheckout(request) : runBrowserCheckout(request),
    );
  },

  /**
   * Where `options` would draw the checkout on this phone.
   *
   * Useful for a diagnostic screen that has to show whether a build will offer Google Pay
   * in the app or in the browser sheet.
   */
  presentationFor(
    options: Pick<OpenCheckoutOptions, 'googlePayInApp' | 'presentation'>,
  ): CheckoutPresentation {
    return resolvePresentation({
      platform: Platform.OS,
      ...(options.googlePayInApp === undefined ? {} : { googlePayInApp: options.googlePayInApp }),
      ...(options.presentation === undefined ? {} : { override: options.presentation }),
    });
  },

  /** True while a checkout is open. */
  get busy(): boolean {
    return guard.busy;
  },
};
