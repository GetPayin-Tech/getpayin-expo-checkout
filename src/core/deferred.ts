/**
 * A promise with its settle functions exposed, which only settles once.
 *
 * The return link can reach the app from more than one source at the same time — a web
 * view navigation, a deep-link event and the URL the app was cold-started with — and the
 * payer can close the screen while one is in flight. Dropping every settle after the
 * first is what keeps those races from producing two results for one checkout.
 */
export interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly settled: () => boolean;
  readonly resolve: (value: T) => void;
  readonly reject: (reason: unknown) => void;
}

/** Creates a {@link Deferred}. */
export function createDeferred<T>(): Deferred<T> {
  let resolveFn!: (value: T) => void;
  let rejectFn!: (reason: unknown) => void;
  let isSettled = false;

  const promise = new Promise<T>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  return {
    promise,
    settled: () => isSettled,
    resolve: (value: T) => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      resolveFn(value);
    },
    reject: (reason: unknown) => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      rejectFn(reason);
    },
  };
}
