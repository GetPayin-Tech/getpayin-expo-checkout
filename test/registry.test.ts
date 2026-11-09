import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getPresenter, registerPresenter, unregisterPresenter } from '../src/sessions/registry';
import { CheckoutStatus } from '../src/types';

const presenter = vi.fn(async () => ({ status: CheckoutStatus.Paid }));
const other = vi.fn(async () => ({ status: CheckoutStatus.Paid }));

describe('presenter registry', () => {
  beforeEach(() => {
    unregisterPresenter(presenter);
    unregisterPresenter(other);
  });

  it('has no presenter before a provider mounts', () => {
    expect(getPresenter()).toBeUndefined();
  });

  it('hands back the mounted provider', () => {
    registerPresenter(presenter);

    expect(getPresenter()).toBe(presenter);
  });

  it('lets a remount replace the previous provider', () => {
    registerPresenter(presenter);
    registerPresenter(other);

    expect(getPresenter()).toBe(other);
  });

  it('clears the registration on unmount', () => {
    registerPresenter(presenter);
    unregisterPresenter(presenter);

    expect(getPresenter()).toBeUndefined();
  });

  it('ignores an unmount from a provider that was already replaced', () => {
    registerPresenter(presenter);
    registerPresenter(other);
    unregisterPresenter(presenter);

    expect(getPresenter()).toBe(other);
  });
});
