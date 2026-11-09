import { beforeEach, describe, expect, it, vi } from 'vitest';

const constants = vi.hoisted(() => ({
  expoConfig: null as Record<string, unknown> | null,
  throwOnRead: false,
}));

vi.mock('expo-constants', () => ({
  default: {
    get expoConfig() {
      if (constants.throwOnRead) {
        throw new Error('ERR_CONSTANTS_MANIFEST_UNAVAILABLE');
      }

      return constants.expoConfig;
    },
  },
}));

import { hostAppSchemes, schemesFromAppConfig } from '../src/webview/appSchemes';

describe('hostAppSchemes', () => {
  beforeEach(() => {
    constants.expoConfig = null;
    constants.throwOnRead = false;
  });

  it('collects every scheme the app answers to, lowercased and without repeats', () => {
    constants.expoConfig = {
      scheme: 'MyApp',
      ios: { scheme: ['myapp-ios'], bundleIdentifier: 'com.Shop.App' },
      android: { scheme: 'myapp-android', package: 'com.shop.app' },
    };

    expect(hostAppSchemes()).toEqual(['myapp', 'myapp-ios', 'myapp-android', 'com.shop.app']);
  });

  it('is empty when the app config is not available', () => {
    expect(hostAppSchemes()).toEqual([]);
  });

  /*
   * `Constants.expoConfig` is a getter that throws in a store or standalone build with no
   * embedded manifest. This is read while the checkout screen renders, so a throw would
   * unmount the screen without settling the checkout at all.
   */
  it('is empty rather than throwing when reading the app config fails', () => {
    constants.throwOnRead = true;

    expect(() => hostAppSchemes()).not.toThrow();
    expect(hostAppSchemes()).toEqual([]);
  });
});

describe('schemesFromAppConfig', () => {
  it('reads a list of schemes and skips blank or non-text entries', () => {
    expect(schemesFromAppConfig({ scheme: ['first', ' ', 7, 'second'] })).toEqual([
      'first',
      'second',
    ]);
  });

  it('copes with a config that has no platform sections', () => {
    expect(schemesFromAppConfig({ scheme: 'myapp' })).toEqual(['myapp']);
  });

  it.each([null, undefined, 'not a config', 7])('copes with %s instead of a config', (config) => {
    expect(schemesFromAppConfig(config)).toEqual([]);
  });

  it("adds the development build's exp+ scheme, made from the slug as expo-dev-client does", () => {
    expect(schemesFromAppConfig({ slug: 'My Shop_App!', scheme: 'myshop' })).toEqual([
      'myshop',
      'exp+myshopapp',
    ]);
  });

  it('adds no development-build scheme for a slug with no usable characters', () => {
    expect(schemesFromAppConfig({ slug: '!!!', scheme: 'myshop' })).toEqual(['myshop']);
  });

  it('reads a scheme written with its separator, which never matches a parsed scheme', () => {
    expect(schemesFromAppConfig({ scheme: ['other://', 'third:'] })).toEqual(['other', 'third']);
  });

  it('skips a scheme that is nothing but a separator', () => {
    expect(schemesFromAppConfig({ scheme: '://' })).toEqual([]);
  });

  it('reads a deep link declared through an Android intent filter', () => {
    expect(
      schemesFromAppConfig({
        scheme: 'myapp',
        android: {
          intentFilters: [
            { action: 'VIEW', data: [{ scheme: 'shopdeep' }, { scheme: 'shopdeep-alt' }] },
            { action: 'VIEW', data: { scheme: 'ignored, not a list' } },
            'not a filter',
          ],
        },
      }),
    ).toEqual(['myapp', 'shopdeep', 'shopdeep-alt']);
  });

  it('reads an iOS scheme declared straight into the Info.plist', () => {
    expect(
      schemesFromAppConfig({
        scheme: 'myapp',
        ios: {
          infoPlist: {
            CFBundleURLTypes: [
              { CFBundleURLSchemes: ['myapp-universal', 'MyApp-Alt'] },
              { CFBundleURLName: 'no schemes here' },
            ],
          },
        },
      }),
    ).toEqual(['myapp', 'myapp-universal', 'myapp-alt']);
  });
});
