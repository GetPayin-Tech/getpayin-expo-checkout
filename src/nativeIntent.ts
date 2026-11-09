import { normalizeToken, parseUrl } from './core/url';

/** The argument expo-router hands to `redirectSystemPath`. */
export interface NativeIntentEvent {
  readonly path: string;
  readonly initial: boolean;
}

/** Splits a path into whole, comparable segments, dropping any query or fragment. */
function pathSegments(value: string): string[] {
  const withoutQuery = (value.split('#')[0] ?? '').split('?')[0] ?? '';

  return withoutQuery
    .split('/')
    .map(normalizeToken)
    .filter((segment) => segment !== '');
}

/** The segments the return link is recognised by inside an expo-router path. */
function returnMarker(returnUrl: string): string[] {
  const parsed = parseUrl(returnUrl);

  if (!parsed) {
    return pathSegments(returnUrl);
  }

  return pathSegments(`${parsed.authority}/${parsed.path}`);
}

/** True when `marker` appears in `segments` as a run of whole segments. */
function containsSegments(segments: string[], marker: string[]): boolean {
  if (marker.length === 0) {
    return false;
  }

  for (let start = 0; start + marker.length <= segments.length; start += 1) {
    if (marker.every((segment, offset) => segments[start + offset] === segment)) {
      return true;
    }
  }

  return false;
}

/**
 * Builds the `redirectSystemPath` an expo-router app needs so the return link does not
 * open as a screen.
 *
 * expo-router treats the returning deep link as a route and shows "Unmatched Route" on
 * top of a checkout that has already been paid. This keeps a cold start on the app's first
 * screen and drops the link entirely when the app is already running, because the package
 * has the result by then.
 *
 * Matching is on whole path segments, so an unrelated route of the app's own that merely
 * reads similarly — `/help/payment-returns-policy`, say — still opens normally.
 *
 * ```tsx
 * // app/+native-intent.tsx
 * import { createPaymentReturnRedirect } from '@getpayin/expo-checkout';
 *
 * export const redirectSystemPath = createPaymentReturnRedirect('myapp://payment-return');
 * ```
 */
export function createPaymentReturnRedirect(
  returnUrl: string,
  initialPath = '/',
): (event: NativeIntentEvent) => string | null {
  const marker = returnMarker(returnUrl);

  return ({ path, initial }: NativeIntentEvent): string | null => {
    if (containsSegments(pathSegments(path), marker)) {
      return initial ? initialPath : null;
    }

    return path;
  };
}
