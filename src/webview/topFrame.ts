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
 * `shouldOverrideUrlLoading` → `createWebViewEvent`), and only its debug fallback adds it,
 * always `true`. Taken as it arrives, every Android request in a release build looked like a
 * frame's, so the return link was refused and a paid checkout never came back to the app.
 *
 * Android cannot tell a frame apart through this library at all, so there a missing report
 * means the page, as it did before the frame rule existed. Everywhere else a missing report
 * still means a frame, so the iOS protection stays closed when the field is absent.
 */
export function isTopFrameRequest(request: TopFrameReport, platform: string): boolean {
  if (typeof request.isTopFrame === 'boolean') {
    return request.isTopFrame;
  }

  return platform === 'android';
}
