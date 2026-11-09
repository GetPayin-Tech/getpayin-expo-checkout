import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview';

import { fallbackText } from '../core/text';
import type { GetPayInCheckoutViewProps } from '../types';
import { hostAppSchemes } from '../webview/appSchemes';
import { buildCheckoutSource } from '../webview/checkoutSource';
import type { CheckoutSource } from '../webview/checkoutSource';
import { openExternalLink } from '../webview/externalLink';
import { createNavigationHandler } from '../webview/navigationHandler';
import { buildCheckoutWebViewProps } from '../webview/platformProps';

const LOAD_FAILED = 'The checkout could not be loaded. Check the connection and try again.';
const LINK_FAILED =
  'The checkout needed another app on this phone, which could not be opened. Nothing has ' +
  'been charged.';

/**
 * The argument `onShouldStartLoadWithRequest` is called with.
 *
 * `react-native-webview` names this `ShouldStartLoadRequest` but does not re-export it from
 * the package root, and `WebViewNavigation` alone is missing `isTopFrame` — the field that
 * says whether the page or a frame inside it asked for the navigation.
 */
type ShouldStartLoadRequest = WebViewNavigation & { readonly isTopFrame: boolean };

/**
 * The hosted checkout drawn in the app's own screen.
 *
 * `<GetPayInProvider>` renders this for {@link GetPayInCheckout.open}. Use it directly to
 * put the checkout in a screen of your own navigation instead of a modal.
 *
 * Nothing is injected into the page and no page-to-app messaging is registered, because
 * WebKit turns Apple Pay off on any page the host app has added scripts to.
 *
 * An unusable `checkoutUrl`, `returnUrl` or `expectedInvoiceId` is reported through
 * `onLoadError` rather than thrown (see `buildCheckoutSource`). They arrive from a server at
 * runtime, and a bad one should not take the screen down with it.
 */
export function GetPayInCheckoutView(props: GetPayInCheckoutViewProps): React.JSX.Element {
  const {
    checkoutUrl,
    returnUrl,
    expectedInvoiceId,
    loadErrorMessage,
    linkErrorMessage,
    onComplete,
    onLoadError,
  } = props;
  const [loading, setLoading] = useState(true);

  /*
   * Everything the navigation handler reads when a navigation happens rather than while
   * rendering, so a fresh inline callback or a changed message does not rebuild it.
   */
  const latest = useRef({ onComplete, onLoadError, loadErrorMessage, linkErrorMessage });

  useEffect(() => {
    latest.current = { onComplete, onLoadError, loadErrorMessage, linkErrorMessage };
  }, [onComplete, onLoadError, loadErrorMessage, linkErrorMessage]);

  /** One object per checkout, which is what the navigation handler is keyed to. */
  const session = useMemo<CheckoutSource>(
    () => buildCheckoutSource(checkoutUrl, returnUrl, expectedInvoiceId),
    [checkoutUrl, returnUrl, expectedInvoiceId],
  );

  const platformProps = useMemo(() => buildCheckoutWebViewProps(Platform.OS), []);
  const ownSchemes = useMemo(() => hostAppSchemes(), []);

  useEffect(() => {
    if (session.error !== undefined) {
      latest.current.onLoadError?.(
        fallbackText(latest.current.loadErrorMessage, LOAD_FAILED),
        session.error,
      );
    }
  }, [session]);

  /*
   * Built on first use per checkout, not during render, and kept until the checkout
   * changes.
   *
   * The handler completes at most once, so it has to be rebuilt when the checkout changes
   * and must NOT be rebuilt merely because the caller passed a fresh inline `onComplete` —
   * that would reset the latch and report one payment twice. The callbacks therefore reach
   * it through a ref, which is read when a navigation happens rather than while rendering.
   */
  const active = useRef<
    { session: CheckoutSource; handler: (request: ShouldStartLoadRequest) => boolean } | undefined
  >(undefined);

  const handleNavigation = useCallback(
    (request: ShouldStartLoadRequest) => {
      const current = active.current;

      if (current === undefined || current.session !== session) {
        const handler = createNavigationHandler({
          returnUrl: session.returnUrl,
          ...(session.expectedInvoiceId === undefined
            ? {}
            : { expectedInvoiceId: session.expectedInvoiceId }),
          ownSchemes,
          onComplete: (result) => latest.current.onComplete(result),
          onExternal: (url) =>
            openExternalLink(url, () =>
              latest.current.onLoadError?.(
                fallbackText(latest.current.linkErrorMessage, LINK_FAILED),
                `The phone could not open ${url}.`,
              ),
            ),
        });

        active.current = { session, handler };

        return handler(request);
      }

      return current.handler(request);
    },
    [session, ownSchemes],
  );

  const handleLoadEnd = useCallback(() => setLoading(false), []);

  const handleError = useCallback(() => {
    setLoading(false);
    latest.current.onLoadError?.(fallbackText(latest.current.loadErrorMessage, LOAD_FAILED));
  }, []);

  return (
    <View style={styles.container}>
      <WebView
        {...platformProps}
        source={{ uri: session.uri }}
        onShouldStartLoadWithRequest={handleNavigation}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        onHttpError={handleError}
        style={styles.webView}
      />
      {loading ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator size="large" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  webView: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
});
