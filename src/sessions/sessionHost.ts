import { createDeferred } from '../core/deferred';
import type { Deferred } from '../core/deferred';
import { cancelledResult } from '../core/returnUrl';
import type { CheckoutPresenter, CheckoutRequest, CheckoutResult } from '../types';

/** The lifecycle of the one checkout a provider is showing. */
export interface CheckoutSessionHost {
  /** Presents a checkout and resolves once it ends. */
  readonly present: CheckoutPresenter;

  /** Settles the open checkout with `result`. */
  readonly finish: (result: CheckoutResult) => void;

  /** Settles the open checkout as cancelled. */
  readonly cancel: (message?: string) => void;

  /** Settles anything still open, for a provider that is going away. */
  readonly dispose: () => void;

  /** The checkout being shown, or `undefined` when there is none. */
  readonly current: () => CheckoutRequest | undefined;
}

interface ActiveSession {
  readonly request: CheckoutRequest;
  readonly deferred: Deferred<CheckoutResult>;
}

const CLOSED_BY_PAYER = 'The payer closed the checkout.';
const CLOSED_BY_UNMOUNT = 'The checkout closed because the provider was unmounted.';

/**
 * Builds the session lifecycle a provider drives, with no React behind it.
 *
 * `onChange` is called with the checkout to show, and with `undefined` once it ends, which
 * is what a provider turns into a re-render.
 */
export function createSessionHost(
  onChange: (request: CheckoutRequest | undefined) => void,
): CheckoutSessionHost {
  let active: ActiveSession | undefined;

  const settle = (result: CheckoutResult): void => {
    const settling = active;

    if (settling === undefined) {
      return;
    }

    active = undefined;
    settling.deferred.resolve(result);
    onChange(undefined);
  };

  return {
    present: (request: CheckoutRequest) => {
      const session: ActiveSession = { request, deferred: createDeferred<CheckoutResult>() };

      active = session;
      onChange(request);

      return session.deferred.promise;
    },
    finish: settle,
    cancel: (message = CLOSED_BY_PAYER) => settle(cancelledResult(message)),
    dispose: () => settle(cancelledResult(CLOSED_BY_UNMOUNT)),
    current: () => active?.request,
  };
}
