import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GetPayInCheckout } from '../src/checkout';
import {
  GetPayInConfigError,
  GetPayInProviderMissingError,
  GetPayInSessionBusyError,
} from '../src/errors';
import { registerPresenter, unregisterPresenter } from '../src/sessions/registry';
import type { CheckoutPresenter } from '../src/types';
import { CheckoutStatus } from '../src/types';

const platform = vi.hoisted(() => ({ OS: 'ios' as string }));

const browser = vi.hoisted(() => ({
  openAuthSessionAsync: vi.fn(),
  dismissAuthSession: vi.fn(),
  dismissBrowser: vi.fn(),
}));

vi.mock('react-native', () => ({ Platform: platform }));

vi.mock('expo-web-browser', () => browser);

vi.mock('expo-linking', () => ({
  addEventListener: () => ({ remove: () => {} }),
  getInitialURL: () => Promise.resolve(null),
}));

const CHECKOUT_URL = 'https://pay.getpayin.com/checkout/abc';
const RETURN_URL = 'myapp://payment-return';

let presenter: CheckoutPresenter;

beforeEach(() => {
  platform.OS = 'ios';
  browser.openAuthSessionAsync.mockReset();
  browser.dismissAuthSession.mockReset();
  browser.dismissBrowser.mockReset();

  if (presenter !== undefined) {
    unregisterPresenter(presenter);
  }

  presenter = vi.fn(async () => ({ status: CheckoutStatus.Paid, invoiceId: 'INV-1' }));
});

describe('GetPayInCheckout.presentationFor', () => {
  it('uses the app screen on iOS', () => {
    platform.OS = 'ios';

    expect(GetPayInCheckout.presentationFor({})).toBe('in-app');
  });

  it('uses the browser sheet on Android before Google approves the app', () => {
    platform.OS = 'android';

    expect(GetPayInCheckout.presentationFor({})).toBe('browser');
  });

  it('uses the app screen on Android once googlePayInApp is on', () => {
    platform.OS = 'android';

    expect(GetPayInCheckout.presentationFor({ googlePayInApp: true })).toBe('in-app');
  });

  it('honours an explicit override', () => {
    platform.OS = 'ios';

    expect(GetPayInCheckout.presentationFor({ presentation: 'browser' })).toBe('browser');
  });
});

describe('GetPayInCheckout.open', () => {
  it.each(['myapp://checkout', 'not a url', ''])('refuses the checkout URL %s', async (url) => {
    await expect(GetPayInCheckout.open(url, { returnUrl: RETURN_URL })).rejects.toBeInstanceOf(
      GetPayInConfigError,
    );
  });

  it('refuses a return link with no scheme', async () => {
    await expect(
      GetPayInCheckout.open(CHECKOUT_URL, { returnUrl: 'payment-return' }),
    ).rejects.toBeInstanceOf(GetPayInConfigError);
  });

  it.each([
    ['ios', 'an empty', ''],
    ['ios', 'a null', null as unknown as string],
    ['android', 'an empty', ''],
    ['android', 'a null', null as unknown as string],
  ])(
    'on %s, refuses %s expectedInvoiceId before opening anything',
    async (os, _label, expectedInvoiceId) => {
      platform.OS = os;
      registerPresenter(presenter);

      await expect(
        GetPayInCheckout.open(CHECKOUT_URL, { returnUrl: RETURN_URL, expectedInvoiceId }),
      ).rejects.toBeInstanceOf(GetPayInConfigError);

      expect(presenter).not.toHaveBeenCalled();
      expect(browser.openAuthSessionAsync).not.toHaveBeenCalled();
      expect(GetPayInCheckout.busy).toBe(false);
    },
  );

  it('asks the mounted provider to present an in-app checkout', async () => {
    registerPresenter(presenter);

    await expect(
      GetPayInCheckout.open(CHECKOUT_URL, { returnUrl: RETURN_URL }),
    ).resolves.toMatchObject({ status: CheckoutStatus.Paid, invoiceId: 'INV-1' });

    expect(presenter).toHaveBeenCalledWith({
      checkoutUrl: CHECKOUT_URL,
      options: { returnUrl: RETURN_URL },
    });
    expect(browser.openAuthSessionAsync).not.toHaveBeenCalled();
  });

  it('explains that the provider is missing rather than failing obscurely', async () => {
    await expect(
      GetPayInCheckout.open(CHECKOUT_URL, { returnUrl: RETURN_URL }),
    ).rejects.toBeInstanceOf(GetPayInProviderMissingError);
  });

  it('uses the browser sheet on Android and leaves the provider alone', async () => {
    platform.OS = 'android';
    registerPresenter(presenter);
    browser.openAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: `${RETURN_URL}?success=1&invoice_id=INV-7`,
    });

    await expect(
      GetPayInCheckout.open(CHECKOUT_URL, { returnUrl: RETURN_URL }),
    ).resolves.toMatchObject({ status: CheckoutStatus.Paid, invoiceId: 'INV-7' });

    expect(browser.openAuthSessionAsync).toHaveBeenCalledWith(CHECKOUT_URL, RETURN_URL);
    expect(presenter).not.toHaveBeenCalled();
  });

  it('refuses a second checkout while one is open, and frees the slot afterwards', async () => {
    let release = (): void => {};

    registerPresenter(
      vi.fn(
        () =>
          new Promise((resolve) => {
            release = () => resolve({ status: CheckoutStatus.Paid });
          }),
      ) as CheckoutPresenter,
    );

    const first = GetPayInCheckout.open(CHECKOUT_URL, { returnUrl: RETURN_URL });

    expect(GetPayInCheckout.busy).toBe(true);
    await expect(
      GetPayInCheckout.open(CHECKOUT_URL, { returnUrl: RETURN_URL }),
    ).rejects.toBeInstanceOf(GetPayInSessionBusyError);

    release();
    await first;

    expect(GetPayInCheckout.busy).toBe(false);
  });

  it('frees the slot after a failed checkout', async () => {
    registerPresenter(vi.fn(async () => Promise.reject(new Error('boom'))) as CheckoutPresenter);

    await expect(GetPayInCheckout.open(CHECKOUT_URL, { returnUrl: RETURN_URL })).rejects.toThrow(
      'boom',
    );
    expect(GetPayInCheckout.busy).toBe(false);
  });

  it('passes the caller options through to the provider', async () => {
    registerPresenter(presenter);

    await GetPayInCheckout.open(CHECKOUT_URL, {
      returnUrl: RETURN_URL,
      title: 'Pay for Gold Plan',
      headerShown: false,
    });

    expect(presenter).toHaveBeenCalledWith({
      checkoutUrl: CHECKOUT_URL,
      options: { returnUrl: RETURN_URL, title: 'Pay for Gold Plan', headerShown: false },
    });
  });
});
