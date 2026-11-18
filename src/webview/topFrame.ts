import type { NavigationRequest } from './navigationHandler';

/** The part of a `react-native-webview` navigation request this reads. */
export interface TopFrameReport {
  readonly isTopFrame?: boolean;
}

/**
 * Whether the page itself asked for a navigation rather than a frame inside it, as
 * `react-native-webview` reports it, with Android's missing report read as the page.
 *
 * iOS reports `isTopFrame` on every request. Android does not: `react-native-webview` 14
 * hands JavaScript a request built without the field (`RNCWebViewClient`'s
 * `shouldOverrideUrlLoading` → `createWebViewEvent`), in debug builds as much as in release
 * ones. Only its fallback for JavaScript running off the phone adds it, always `true`.
 * Taken as it arrives, every Android request looked like a frame's, so the return link was
 * refused and a paid checkout never came back to the app.
 *
 * Android cannot tell a frame from the page through this library at all, so there a
 * missing report means the page, as it did before the frame rule existed. That leaves the
 * frame rule iOS-only: on Android a frame inside the checkout page can still end it or open
 * another app, and the `invoice.paid` webhook on the server stays the answer to trust.
 * Everywhere else a missing report still means a frame, so the iOS rule stays closed.
 */
export function isTopFrameRequest(request: TopFrameReport, platform: string): boolean {
  if (typeof request.isTopFrame === 'boolean') {
    return request.isTopFrame;
  }

  return platform === 'android';
}

/**
 * The navigation handler's request, from what `onShouldStartLoadWithRequest` receives.
 *
 * The checkout view goes through this rather than passing the web view's request along, so
 * the frame report is always read by {@link isTopFrameRequest} and never taken as it arrives.
 */
export function toNavigationRequest(
  request: TopFrameReport & { readonly url: string },
  platform: string,
): NavigationRequest {
  return { url: request.url, isTopFrame: isTopFrameRequest(request, platform) };
}
