import * as Linking from 'expo-linking';

import { matchesReturnUrl } from '../core/returnUrl';

/** Stops a watcher started by {@link watchForReturnUrl}. */
export interface DeepLinkWatcher {
  readonly stop: () => void;
}

/**
 * Values already taken from `getInitialURL()`, which must be read at most once each.
 *
 * The two sources differ in kind. The `url` event is a push: the system delivers each
 * link once, as it happens, so a watcher only has to ignore a second copy of its own.
 * `getInitialURL()` is a pull of state that persists — it keeps returning the same link
 * for as long as the activity's intent holds it — so without this record every later
 * checkout would read the same link again and report a payment that belongs to an earlier
 * one, or to no checkout at all.
 *
 * It grows only by distinct launch and recreated-activity intents, of which a process
 * sees a handful.
 */
const consumedInitialUrls = new Set<string>();

/**
 * Takes the link the app was launched with out of circulation before any checkout starts.
 *
 * The return scheme is public, so any web page, message or other app on the phone can
 * cold-start the app with a forged `?success=1&invoice_id=…`. That link belongs to no
 * session — a cold start has destroyed the promise that was waiting for a result — so
 * attributing it to the next checkout the payer opens would report an order as paid that
 * nobody has paid for.
 */
const launchUrlRead = Linking.getInitialURL()
  .then((url) => {
    if (url !== null) {
      consumedInitialUrls.add(url);
    }
  })
  .catch(ignore);

/**
 * Watches for the return link arriving as a deep link.
 *
 * Both sources are covered: the `url` event for an app that is already running, and
 * `getInitialURL()` for an activity the system recreated under a live session, which on
 * Android carries the returning link in its new intent. Each watcher acts at most once,
 * so a link that arrives from both at the same moment produces one result.
 */
export function watchForReturnUrl(
  returnUrl: string,
  onMatch: (url: string) => void,
): DeepLinkWatcher {
  let stopped = false;
  let matched = false;

  const handle = (url: string | null): void => {
    if (stopped || matched || url === null || !matchesReturnUrl(url, returnUrl)) {
      return;
    }

    matched = true;
    onMatch(url);
  };

  const subscription = Linking.addEventListener('url', ({ url }) => handle(url));

  void launchUrlRead
    .then(() => Linking.getInitialURL())
    .then((url) => {
      if (url === null || consumedInitialUrls.has(url)) {
        return;
      }

      consumedInitialUrls.add(url);
      handle(url);
    })
    .catch(ignore);

  return {
    stop: () => {
      stopped = true;
      subscription.remove();
    },
  };
}

/** Swallows a rejection from a source that has nothing useful to report. */
function ignore(): void {}
