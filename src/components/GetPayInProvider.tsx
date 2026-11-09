import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { registerPresenter, unregisterPresenter } from '../sessions/registry';
import { createSessionHost } from '../sessions/sessionHost';
import type { CheckoutRequest, GetPayInProviderProps } from '../types';
import { GetPayInCheckoutView } from './GetPayInCheckoutView';

const DEFAULT_TITLE = 'Secure checkout';

/**
 * Hosts the in-app checkout screen.
 *
 * Mount it once at the root of the app, above the navigation. It draws the checkout in a
 * full-screen modal with the app's own top bar, which is what keeps the browser's own bar
 * off the payer's screen, and it is what {@link GetPayInCheckout.open} needs in order to
 * present anything.
 */
export function GetPayInProvider({ children }: GetPayInProviderProps): React.JSX.Element {
  const [request, setRequest] = useState<CheckoutRequest | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);

  const host = useMemo(
    () =>
      createSessionHost((next) => {
        setLoadError(undefined);
        setRequest(next);
      }),
    [],
  );

  useEffect(() => {
    registerPresenter(host.present);

    return () => {
      unregisterPresenter(host.present);
      host.dispose();
    };
  }, [host]);

  const cancel = useCallback(() => host.cancel(), [host]);

  const dismissAfterFailure = useCallback(() => host.cancel(loadError), [host, loadError]);

  /*
   * A checkout that cannot load would otherwise be a blank modal, and with `headerShown`
   * off there is no way out of it on iOS, where a modal has no hardware back button. The
   * session would never settle: the `open()` promise would stay pending and the guard
   * would report busy for the rest of the process, so every later checkout would be
   * refused. The failure therefore always carries its own way out.
   */
  const failed = loadError !== undefined;
  const headerShown = request?.options.headerShown !== false || failed;

  return (
    <>
      {children}
      <Modal
        visible={request !== undefined}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={cancel}
      >
        <SafeAreaView style={styles.screen}>
          {headerShown ? (
            <View style={styles.header}>
              <Text style={styles.title} numberOfLines={1}>
                {request?.options.title ?? DEFAULT_TITLE}
              </Text>
              <Pressable
                onPress={failed ? dismissAfterFailure : cancel}
                accessibilityRole="button"
                accessibilityLabel="Close checkout"
                hitSlop={12}
                style={styles.closeButton}
              >
                <Text style={styles.closeLabel}>Close</Text>
              </Pressable>
            </View>
          ) : null}
          {failed ? (
            <View style={styles.failure}>
              <Text style={styles.failureText}>{loadError}</Text>
            </View>
          ) : null}
          {request && !failed ? (
            <GetPayInCheckoutView
              checkoutUrl={request.checkoutUrl}
              returnUrl={request.options.returnUrl}
              {...(request.options.statusResolver === undefined
                ? {}
                : { statusResolver: request.options.statusResolver })}
              {...(request.options.expectedInvoiceId === undefined
                ? {}
                : { expectedInvoiceId: request.options.expectedInvoiceId })}
              onComplete={host.finish}
              onLoadError={setLoadError}
            />
          ) : null}
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: Platform.OS === 'ios' ? 48 : 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e2e6',
  },
  title: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#111114',
  },
  closeButton: {
    paddingLeft: 16,
  },
  closeLabel: {
    fontSize: 16,
    color: '#0a67ff',
  },
  failure: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  failureText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: '#5c5c63',
  },
});
