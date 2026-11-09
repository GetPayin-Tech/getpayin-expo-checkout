import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { watchForReturnUrl } from '../src/sessions/deepLink';

const linking = vi.hoisted(() => ({
  listeners: [] as Array<(event: { url: string }) => void>,
  initialUrl: { current: null as string | null },
  initialFails: { current: false },
  removals: { count: 0 },
}));

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
  getInitialURL: () =>
    linking.initialFails.current
      ? Promise.reject(new Error('no initial URL available'))
      : Promise.resolve(linking.initialUrl.current),
}));

const RETURN_URL = 'myapp://payment-return';

function emit(url: string): void {
  for (const listener of [...linking.listeners]) {
    listener({ url });
  }
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

let counter = 0;

function uniqueReturn(): string {
  counter += 1;

  return `${RETURN_URL}?success=1&invoice_id=INV-${counter}`;
}

beforeEach(() => {
  linking.listeners.length = 0;
  linking.initialUrl.current = null;
  linking.initialFails.current = false;
  linking.removals.count = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('watchForReturnUrl', () => {
  it('reports the return link arriving while the app runs', async () => {
    const onMatch = vi.fn();
    const watcher = watchForReturnUrl(RETURN_URL, onMatch);
    const url = uniqueReturn();

    await flush();
    emit(url);

    expect(onMatch).toHaveBeenCalledWith(url);
    watcher.stop();
  });

  it('ignores a deep link that is not the return link', async () => {
    const onMatch = vi.fn();
    const watcher = watchForReturnUrl(RETURN_URL, onMatch);

    await flush();
    emit('myapp://orders/42');

    expect(onMatch).not.toHaveBeenCalled();
    watcher.stop();
  });

  it('acts on one URL only once, however often it arrives', async () => {
    const onMatch = vi.fn();
    const watcher = watchForReturnUrl(RETURN_URL, onMatch);
    const url = uniqueReturn();

    await flush();
    emit(url);
    emit(url);

    expect(onMatch).toHaveBeenCalledTimes(1);
    watcher.stop();
  });

  it('reports the link a cold start carried', async () => {
    const url = uniqueReturn();
    const onMatch = vi.fn();

    linking.initialUrl.current = url;

    const watcher = watchForReturnUrl(RETURN_URL, onMatch);
    await flush();

    expect(onMatch).toHaveBeenCalledWith(url);
    watcher.stop();
  });

  it('does not let a consumed cold-start link settle a later checkout', async () => {
    const url = uniqueReturn();

    linking.initialUrl.current = url;

    const first = vi.fn();
    const firstWatcher = watchForReturnUrl(RETURN_URL, first);
    await flush();
    firstWatcher.stop();

    const second = vi.fn();
    const secondWatcher = watchForReturnUrl(RETURN_URL, second);
    await flush();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    secondWatcher.stop();
  });

  it('keeps watching when the phone cannot say what link started the app', async () => {
    linking.initialFails.current = true;

    const onMatch = vi.fn();
    const watcher = watchForReturnUrl(RETURN_URL, onMatch);
    const url = uniqueReturn();

    await flush();
    emit(url);

    expect(onMatch).toHaveBeenCalledWith(url);
    watcher.stop();
  });

  it('removes its subscription and goes quiet once stopped', async () => {
    const onMatch = vi.fn();
    const watcher = watchForReturnUrl(RETURN_URL, onMatch);

    await flush();
    watcher.stop();
    emit(uniqueReturn());

    expect(linking.removals.count).toBe(1);
    expect(onMatch).not.toHaveBeenCalled();
  });

  it('ignores a cold-start link that lands after it was stopped', async () => {
    linking.initialUrl.current = uniqueReturn();

    const onMatch = vi.fn();
    const watcher = watchForReturnUrl(RETURN_URL, onMatch);

    watcher.stop();
    await flush();

    expect(onMatch).not.toHaveBeenCalled();
  });
});
