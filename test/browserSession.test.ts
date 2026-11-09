import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runBrowserCheckout } from '../src/sessions/browserSession';
import type { CheckoutRequest } from '../src/types';
import { CheckoutStatus } from '../src/types';

const browser = vi.hoisted(() => ({
  openAuthSessionAsync: vi.fn(),
  dismissAuthSession: vi.fn(),
  dismissBrowser: vi.fn(),
}));

const linking = vi.hoisted(() => ({
  listeners: [] as Array<(event: { url: string }) => void>,
  removals: { count: 0 },
}));

vi.mock('expo-web-browser', () => browser);

vi.mock('expo-linking', () => ({
  addEventListener: (_type: string, callback: (event: { url: string }) => void) => {
    linking.listeners.push(callback);

    return {
      remove: () => {
        linking.removals.count += 1;
        linking.listeners.splice(linking.listeners.indexOf(callback), 1);
      },
    };
  },
  getInitialURL: () => Promise.resolve(null),
}));

const RETURN_URL = 'myapp://payment-return';

const REQUEST: CheckoutRequest = {
  checkoutUrl: 'https://pay.getpayin.com/checkout/abc',
  options: { returnUrl: RETURN_URL },
};

let counter = 0;

function uniqueReturn(status: string): string {
  counter += 1;

  return `${RETURN_URL}?status=${status}&invoice_id=B-${counter}`;
}

function emit(url: string): void {
  for (const listener of [...linking.listeners]) {
    listener({ url });
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeEach(() => {
  browser.openAuthSessionAsync.mockReset();
  browser.dismissAuthSession.mockReset();
  browser.dismissBrowser.mockReset();
  linking.listeners.length = 0;
  linking.removals.count = 0;
});

describe('runBrowserCheckout', () => {
  it('reads the result off the URL the browser sheet returned', async () => {
    const url = uniqueReturn('paid');

    browser.openAuthSessionAsync.mockResolvedValue({ type: 'success', url });

    await expect(runBrowserCheckout(REQUEST)).resolves.toMatchObject({
      status: CheckoutStatus.Paid,
      returnUrl: url,
    });
  });

  it('reports a decline the sheet returned', async () => {
    browser.openAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: `${uniqueReturn('not_paid')}&message=Card+declined`,
    });

    await expect(runBrowserCheckout(REQUEST)).resolves.toMatchObject({
      status: CheckoutStatus.NotPaid,
      message: 'Card declined',
    });
  });

  it('takes the result from a deep link that arrives while the sheet is open', async () => {
    const url = uniqueReturn('paid');

    browser.openAuthSessionAsync.mockImplementation(async () => {
      emit(url);
      await wait(10);

      return { type: 'dismiss' };
    });

    await expect(runBrowserCheckout(REQUEST)).resolves.toMatchObject({
      status: CheckoutStatus.Paid,
      returnUrl: url,
    });
  });

  it('waits out the grace period for a deep link the dismissal raced', async () => {
    const url = uniqueReturn('paid');

    browser.openAuthSessionAsync.mockImplementation(async () => {
      setTimeout(() => emit(url), 30);

      return { type: 'cancel' };
    });

    await expect(runBrowserCheckout(REQUEST)).resolves.toMatchObject({
      status: CheckoutStatus.Paid,
      returnUrl: url,
    });
  });

  it('reports a cancellation when no return link follows the dismissal', async () => {
    browser.openAuthSessionAsync.mockResolvedValue({ type: 'cancel' });

    await expect(runBrowserCheckout(REQUEST)).resolves.toMatchObject({
      status: CheckoutStatus.Cancelled,
    });
  });

  it('closes the sheet and stops listening once it is done', async () => {
    browser.openAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: uniqueReturn('paid'),
    });

    await runBrowserCheckout(REQUEST);

    expect(browser.dismissAuthSession).toHaveBeenCalledTimes(1);
    expect(browser.dismissBrowser).toHaveBeenCalledTimes(1);
    expect(linking.removals.count).toBe(1);
    expect(linking.listeners).toHaveLength(0);
  });

  it('still returns the result when a dismiss call is unavailable on the platform', async () => {
    browser.openAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: uniqueReturn('paid'),
    });
    browser.dismissAuthSession.mockImplementation(() => {
      throw new Error('iOS only');
    });
    browser.dismissBrowser.mockRejectedValue(new Error('no open browser'));

    await expect(runBrowserCheckout(REQUEST)).resolves.toMatchObject({
      status: CheckoutStatus.Paid,
    });
  });

  it('stops listening and closes the sheet when the browser call itself fails', async () => {
    browser.openAuthSessionAsync.mockRejectedValue(new Error('no browser available'));

    await expect(runBrowserCheckout(REQUEST)).rejects.toThrow('no browser available');
    expect(linking.removals.count).toBe(1);
    expect(browser.dismissBrowser).toHaveBeenCalledTimes(1);
  });

  it('passes a status resolver through to the return link reader', async () => {
    browser.openAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: `${RETURN_URL}?outcome=settled`,
    });

    await expect(
      runBrowserCheckout({
        ...REQUEST,
        options: {
          returnUrl: RETURN_URL,
          statusResolver: (params) =>
            params.outcome === 'settled' ? { status: CheckoutStatus.Paid } : undefined,
        },
      }),
    ).resolves.toMatchObject({ status: CheckoutStatus.Paid });
  });

  it('ignores a sheet URL that is not the return link', async () => {
    browser.openAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: 'https://pay.getpayin.com/checkout/abc?status=paid',
    });

    await expect(runBrowserCheckout(REQUEST)).resolves.toMatchObject({
      status: CheckoutStatus.Cancelled,
    });
  });

  it('refuses a return link naming an invoice other than the one opened', async () => {
    browser.openAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: `${RETURN_URL}?status=paid&invoice_id=INV-ATTACKER`,
    });

    await expect(
      runBrowserCheckout({
        ...REQUEST,
        options: { returnUrl: RETURN_URL, expectedInvoiceId: 'INV-REAL' },
      }),
    ).resolves.toMatchObject({ status: CheckoutStatus.NotPaid });
  });

  it('ignores a success result that carries no URL', async () => {
    browser.openAuthSessionAsync.mockResolvedValue({ type: 'success' });

    await expect(runBrowserCheckout(REQUEST)).resolves.toMatchObject({
      status: CheckoutStatus.Cancelled,
    });
  });
});
