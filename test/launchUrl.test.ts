import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * The app's return scheme is public: any web page, message or other app on the phone can
 * invoke it. A link planted that way cold-starts the app, and `getInitialURL()` keeps
 * returning it for the life of the process. If a later checkout were allowed to read it,
 * the package would report that checkout as paid, with an invoice id the attacker chose.
 *
 * The module is imported fresh in each test so the launch URL is read at the point the
 * test has arranged it, which is what happens on a real launch.
 */

const linking = vi.hoisted(() => ({
  listeners: [] as Array<(event: { url: string }) => void>,
  initialUrl: { current: null as string | null },
}));

vi.mock('expo-linking', () => ({
  addEventListener: (_type: string, callback: (event: { url: string }) => void) => {
    linking.listeners.push(callback);

    return {
      remove: () => linking.listeners.splice(linking.listeners.indexOf(callback), 1),
    };
  },
  getInitialURL: () => Promise.resolve(linking.initialUrl.current),
}));

const RETURN_URL = 'myapp://payment-return';

async function importWatcher() {
  vi.resetModules();

  return (await import('../src/sessions/deepLink')).watchForReturnUrl;
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function emit(url: string): void {
  for (const listener of [...linking.listeners]) {
    listener({ url });
  }
}

beforeEach(() => {
  linking.listeners.length = 0;
  linking.initialUrl.current = null;
});

describe('the link the app was launched with', () => {
  it('never settles a checkout opened later in the same process', async () => {
    linking.initialUrl.current = `${RETURN_URL}?success=1&invoice_id=INV-ATTACKER`;

    const watchForReturnUrl = await importWatcher();
    await flush();

    const onMatch = vi.fn();
    const watcher = watchForReturnUrl(RETURN_URL, onMatch);
    await flush();

    expect(onMatch).not.toHaveBeenCalled();
    watcher.stop();
  });

  it('does not block a genuine link that arrives while the checkout is open', async () => {
    linking.initialUrl.current = `${RETURN_URL}?success=1&invoice_id=INV-ATTACKER`;

    const watchForReturnUrl = await importWatcher();
    await flush();

    const onMatch = vi.fn();
    const watcher = watchForReturnUrl(RETURN_URL, onMatch);
    await flush();

    const genuine = `${RETURN_URL}?success=1&invoice_id=INV-REAL`;
    emit(genuine);

    expect(onMatch).toHaveBeenCalledExactlyOnceWith(genuine);
    watcher.stop();
  });

  it('accepts an intent URL that differs from the launch URL, as a recreated activity sends', async () => {
    linking.initialUrl.current = null;

    const watchForReturnUrl = await importWatcher();
    await flush();

    const recreated = `${RETURN_URL}?success=1&invoice_id=INV-REAL`;
    linking.initialUrl.current = recreated;

    const onMatch = vi.fn();
    const watcher = watchForReturnUrl(RETURN_URL, onMatch);
    await flush();

    expect(onMatch).toHaveBeenCalledExactlyOnceWith(recreated);
    watcher.stop();
  });

  it('reports a repeated link once per checkout, not once per process', async () => {
    const watchForReturnUrl = await importWatcher();
    await flush();

    const url = `${RETURN_URL}?success=1`;

    const first = vi.fn();
    const firstWatcher = watchForReturnUrl(RETURN_URL, first);
    await flush();
    emit(url);
    emit(url);
    firstWatcher.stop();

    const second = vi.fn();
    const secondWatcher = watchForReturnUrl(RETURN_URL, second);
    await flush();
    emit(url);
    secondWatcher.stop();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
