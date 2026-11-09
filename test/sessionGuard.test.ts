import { describe, expect, it } from 'vitest';

import { SessionGuard } from '../src/core/sessionGuard';
import { GetPayInSessionBusyError } from '../src/errors';

describe('SessionGuard', () => {
  it('runs one checkout and hands back its result', async () => {
    const guard = new SessionGuard();

    await expect(guard.run(async () => 'done')).resolves.toBe('done');
    expect(guard.busy).toBe(false);
  });

  it('refuses a second checkout while the first is open', async () => {
    const guard = new SessionGuard();
    let release = (): void => {};
    const first = guard.run(() => new Promise<string>((resolve) => (release = () => resolve('a'))));

    expect(guard.busy).toBe(true);
    await expect(guard.run(async () => 'b')).rejects.toBeInstanceOf(GetPayInSessionBusyError);

    release();
    await expect(first).resolves.toBe('a');
  });

  it('frees the slot after a failure', async () => {
    const guard = new SessionGuard();

    await expect(
      guard.run(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(guard.busy).toBe(false);
    await expect(guard.run(async () => 'next')).resolves.toBe('next');
  });
});
