import type { CheckoutPresenter } from '../types';

let current: CheckoutPresenter | undefined;

/** Registers the mounted provider as the one that draws in-app checkouts. */
export function registerPresenter(presenter: CheckoutPresenter): void {
  current = presenter;
}

/** Clears `presenter`, if it is still the registered one. */
export function unregisterPresenter(presenter: CheckoutPresenter): void {
  if (current === presenter) {
    current = undefined;
  }
}

/** The mounted provider's presenter, or `undefined` when no provider is mounted. */
export function getPresenter(): CheckoutPresenter | undefined {
  return current;
}
