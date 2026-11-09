import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview';

import { GetPayInCheckoutError } from '../errors';
import { assertCheckoutUrl, assertReturnUrl } from '../core/validate';
import type { GetPayInCheckoutViewProps } from '../types';
import { createNavigationHandler } from '../webview/navigationHandler';
import { buildCheckoutWebViewProps } from '../webview/platformProps';

const LOAD_FAILED = 'The checkout could not be loaded. Check the connection and try again.';

interface CheckoutSource {
  readonly uri: string;
  readonly returnUrl: string;
  readonly error?: string;
}

interface CheckoutSession extends CheckoutSource {
  readonly statusResolver: GetPayInCheckoutViewProps['statusResolver'];
  readonly expectedInvoiceId: GetPayInCheckoutViewProps['expectedInvoiceId'];
}

/** Validates the props once per checkout, as a value rather than as a thrown error. */
function buildSource(checkoutUrl: string, returnUrl: string): CheckoutSource {
  try {
    return { uri: assertCheckoutUrl(checkoutUrl), returnUrl: assertReturnUrl(returnUrl) };
  } catch (cause) {
    const error = cause instanceof GetPayInCheckoutError ? cause.message : String(cause);

    return { uri: 'about:blank', returnUrl, error };
  }
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
 * An unusable `checkoutUrl` is reported through `onLoadError` rather than thrown. It
 * arrives from a server at runtime, and a bad one should not take the screen down with it.
 */
export function GetPayInCheckoutView(props: GetPayInCheckoutViewProps): React.JSX.Element {
  const { checkoutUrl, returnUrl, statusResolver, expectedInvoiceId, onComplete, onLoadError } =
    props;
  const [loading, setLoading] = useState(true);

  const callbacks = useRef({ onComplete, onLoadError });

  useEffect(() => {
    callbacks.current = { onComplete, onLoadError };
  }, [onComplete, onLoadError]);

  /** One object per checkout, which is what the navigation handler is keyed to. */
  const session = useMemo<CheckoutSession>(
    () => ({
      ...buildSource(checkoutUrl, returnUrl),
      statusResolver,
      expectedInvoiceId,
    }),
    [checkoutUrl, returnUrl, statusResolver, expectedInvoiceId],
  );

  const platformProps = useMemo(() => buildCheckoutWebViewProps(Platform.OS), []);

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
          ...(session.statusResolver === undefined
            ? {}
            : { statusResolver: session.statusResolver }),
          ...(session.expectedInvoiceId === undefined
            ? {}
            : { expectedInvoiceId: session.expectedInvoiceId }),
          onComplete: (result) => callbacks.current.onComplete(result),
          onExternal: (url) => {
            void Linking.canOpenURL(url)
              .then((supported) => (supported ? Linking.openURL(url) : undefined))
              .catch(() => {
                callbacks.current.onLoadError?.(`The phone could not open ${url}.`);
              });
          },
        });

        active.current = { session, handler };

        return handler(request.url);
      }

      return current.handler(request.url);
    },
    [session],
  );

  const handleLoadEnd = useCallback(() => setLoading(false), []);

  const handleError = useCallback(() => {
    setLoading(false);
    callbacks.current.onLoadError?.(LOAD_FAILED);
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
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
});
