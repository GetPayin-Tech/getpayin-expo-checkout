import { describe, expect, it } from 'vitest';

import { createDeferred } from '../src/core/deferred';

describe('createDeferred', () => {
  it('resolves once and reports that it settled', async () => {
    const deferred = createDeferred<string>();

    expect(deferred.settled()).toBe(false);
    deferred.resolve('first');
    expect(deferred.settled()).toBe(true);

    await expect(deferred.promise).resolves.toBe('first');
  });

  it('drops every settle after the first', async () => {
    const deferred = createDeferred<string>();

    deferred.resolve('first');
    deferred.resolve('second');
    deferred.reject(new Error('late'));

    await expect(deferred.promise).resolves.toBe('first');
  });

  it('rejects when it has not already resolved', async () => {
    const deferred = createDeferred<string>();

    deferred.reject(new Error('nope'));
    deferred.resolve('ignored');

    await expect(deferred.promise).rejects.toThrow('nope');
  });
});
