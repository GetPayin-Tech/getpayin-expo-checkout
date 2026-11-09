import { GetPayInSessionBusyError } from '../errors';

/**
 * Lets one checkout run at a time.
 *
 * Two checkouts at once would stack a second web view over a live one, and the payer's
 * card details would go to whichever happened to be on top.
 */
export class SessionGuard {
  private active = false;

  /** True while a checkout is running. */
  get busy(): boolean {
    return this.active;
  }

  /**
   * Runs `work`, refusing to start while another run is in flight.
   *
   * @throws {GetPayInSessionBusyError} when a checkout is already running.
   */
  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.active) {
      throw new GetPayInSessionBusyError();
    }

    this.active = true;

    try {
      return await work();
    } finally {
      this.active = false;
    }
  }
}
