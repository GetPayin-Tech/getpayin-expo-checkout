import type { CheckoutPresentation, PlatformName } from '../types';

/** Inputs the presentation rule decides on. */
export interface PresentationInput {
  readonly platform: PlatformName;
  readonly googlePayInApp?: boolean;
  readonly override?: CheckoutPresentation;
}

/**
 * Decides where the checkout is drawn.
 *
 * iOS always uses the app's own screen, where Apple Pay works. Android uses the app's own
 * screen only when the client has turned on `googlePayInApp`, which is valid once Google
 * has approved their app; before that the browser sheet offers Google Pay with no
 * approval needed. Anything else falls back to the browser sheet.
 */
export function resolvePresentation(input: PresentationInput): CheckoutPresentation {
  if (input.override !== undefined) {
    return input.override;
  }

  if (input.platform === 'ios') {
    return 'in-app';
  }

  if (input.platform === 'android') {
    return input.googlePayInApp === true ? 'in-app' : 'browser';
  }

  return 'browser';
}
