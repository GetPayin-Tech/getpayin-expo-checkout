import { describe, expect, it, vi } from 'vitest';

import { createSessionHost } from '../src/sessions/sessionHost';
import type { CheckoutRequest } from '../src/types';
import { CheckoutStatus } from '../src/types';

const REQUEST: CheckoutRequest = {
  checkoutUrl: 'https://pay.getpayin.com/checkout/abc',
  options: { returnUrl: 'myapp://payment-return' },
};

describe('createSessionHost', () => {
  it('announces the checkout to show and resolves with its result', async () => {
    const onChange = vi.fn();
    const host = createSessionHost(onChange);
    const promise = host.present(REQUEST);

    expect(onChange).toHaveBeenLastCalledWith(REQUEST);
    expect(host.current()).toBe(REQUEST);

    host.finish({ status: CheckoutStatus.Paid, invoiceId: 'INV-1' });

    await expect(promise).resolves.toMatchObject({
      status: CheckoutStatus.Paid,
      invoiceId: 'INV-1',
    });
    expect(onChange).toHaveBeenLastCalledWith(undefined);
    expect(host.current()).toBeUndefined();
  });

  it('reports a closed screen as cancelled', async () => {
    const host = createSessionHost(vi.fn());
    const promise = host.present(REQUEST);

    host.cancel();

    await expect(promise).resolves.toMatchObject({ status: CheckoutStatus.Cancelled });
  });

  it('carries a reason when one is given', async () => {
    const host = createSessionHost(vi.fn());
    const promise = host.present(REQUEST);

    host.cancel('went away');

    await expect(promise).resolves.toEqual({
      status: CheckoutStatus.Cancelled,
      message: 'went away',
    });
  });

  it('settles an open checkout when the provider is unmounted', async () => {
    const host = createSessionHost(vi.fn());
    const promise = host.present(REQUEST);

    host.dispose();

    await expect(promise).resolves.toMatchObject({ status: CheckoutStatus.Cancelled });
  });

  it('settles once, so a close after a result does not change it', async () => {
    const onChange = vi.fn();
    const host = createSessionHost(onChange);
    const promise = host.present(REQUEST);

    host.finish({ status: CheckoutStatus.Paid });
    host.cancel();
    host.dispose();

    await expect(promise).resolves.toMatchObject({ status: CheckoutStatus.Paid });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('ignores a close when nothing is open', () => {
    const onChange = vi.fn();
    const host = createSessionHost(onChange);

    host.cancel();
    host.dispose();
    host.finish({ status: CheckoutStatus.Paid });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('presents a second checkout after the first ended', async () => {
    const host = createSessionHost(vi.fn());

    host.finish({ status: CheckoutStatus.Paid });

    const first = host.present(REQUEST);
    host.finish({ status: CheckoutStatus.Paid });
    await first;

    const second = host.present(REQUEST);
    host.cancel();

    await expect(second).resolves.toMatchObject({ status: CheckoutStatus.Cancelled });
  });
});
