/** Base class for every error this package throws. */
export class GetPayInCheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Thrown when `open()` is called with something that is not a usable checkout URL. */
export class GetPayInConfigError extends GetPayInCheckoutError {}

/**
 * Thrown when an in-app checkout is opened with no `<GetPayInProvider>` mounted above it.
 */
export class GetPayInProviderMissingError extends GetPayInCheckoutError {
  constructor() {
    super(
      'No <GetPayInProvider> is mounted. Wrap your app in <GetPayInProvider> to open the ' +
        'checkout in the app, or render <GetPayInCheckoutView> in a screen of your own.',
    );
  }
}

/** Thrown when a checkout is opened while another one is still running. */
export class GetPayInSessionBusyError extends GetPayInCheckoutError {
  constructor() {
    super('A checkout is already open. Wait for it to finish before opening another.');
  }
}
