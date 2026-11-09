import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview';

import type { GetPayInCheckoutViewProps } from '../types';
import { hostAppSchemes } from '../webview/appSchemes';
import { buildCheckoutSource } from '../webview/checkoutSource';
import type { CheckoutSource } from '../webview/checkoutSource';
import { openExternalLink } from '../webview/externalLink';
import { createNavigationHandler } from '../webview/navigationHandler';
import { buildCheckoutWebViewProps } from '../webview/platformProps';

const LOAD_FAILED = 'The checkout could not be loaded. Check the connection and try again.';

interface CheckoutSession extends CheckoutSource {
  readonly expectedInvoiceId: GetPayInCheckoutViewProps['expectedInvoiceId'];
}

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
  const { checkoutUrl, returnUrl, expectedInvoiceId, loadErrorMessage, onComplete, onLoadError } =
    props;
  const [loading, setLoading] = useState(true);

  const callbacks = useRef({ onComplete, onLoadError });

  useEffect(() => {
    callbacks.current = { onComplete, onLoadError };
  }, [onComplete, onLoadError]);

  /** One object per checkout, which is what the navigation handler is keyed to. */
  const session = useMemo<CheckoutSession>(
    () => ({
      ...buildCheckoutSource(checkoutUrl, returnUrl, expectedInvoiceId),
      expectedInvoiceId,
    }),
    [checkoutUrl, returnUrl, expectedInvoiceId],
  );

  const platformProps = useMemo(() => buildCheckoutWebViewProps(Platform.OS), []);
  const ownSchemes = useMemo(() => hostAppSchemes(), []);

  useEffect(() => {
    if (session.error !== undefined) {
      callbacks.current.onLoadError?.(session.error);
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
    { session: CheckoutSession; handler: (url: string) => boolean } | undefined
  >(undefined);

  const handleNavigation = useCallback(
    (request: WebViewNavigation) => {
      const current = active.current;

      if (current === undefined || current.session !== session) {
        const handler = createNavigationHandler({
          returnUrl: session.returnUrl,
          ...(session.expectedInvoiceId === undefined
            ? {}
            : { expectedInvoiceId: session.expectedInvoiceId }),
          ownSchemes,
          onComplete: (result) => callbacks.current.onComplete(result),
          onExternal: openExternalLink,
        });

        active.current = { session, handler };

        return handler(request.url);
      }

      return current.handler(request.url);
    },
    [session, ownSchemes],
  );

  const handleLoadEnd = useCallback(() => setLoading(false), []);

  const handleError = useCallback(() => {
    setLoading(false);
    callbacks.current.onLoadError?.(loadErrorMessage ?? LOAD_FAILED);
  }, [loadErrorMessage]);

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
  // Written out rather than StyleSheet.absoluteFillObject, which React Native 0.88 (Expo 58)
  // removed: spreading it there adds nothing and the overlay loses its position.
  loading: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
});
