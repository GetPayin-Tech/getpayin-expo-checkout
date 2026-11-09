import { beforeEach, describe, expect, it, vi } from 'vitest';

const constants = vi.hoisted(() => ({ expoConfig: null as Record<string, unknown> | null }));

vi.mock('expo-constants', () => ({ default: constants }));

import { hostAppSchemes } from '../src/webview/appSchemes';

describe('hostAppSchemes', () => {
  beforeEach(() => {
    constants.expoConfig = null;
  });

  it('collects every scheme the app answers to, lowercased', () => {
    constants.expoConfig = {
      scheme: 'MyApp',
      ios: { scheme: ['myapp-ios'], bundleIdentifier: 'com.Shop.App' },
      android: { scheme: 'myapp-android', package: 'com.shop.app' },
    };

    expect(hostAppSchemes()).toEqual([
      'myapp',
      'myapp-ios',
      'myapp-android',
      'com.shop.app',
      'com.shop.app',
    ]);
  });

  it('reads a list of schemes and skips blank or non-text entries', () => {
    constants.expoConfig = { scheme: ['first', ' ', 7, 'second'] };

    expect(hostAppSchemes()).toEqual(['first', 'second']);
  });

  it('is empty when the app config is not available', () => {
    expect(hostAppSchemes()).toEqual([]);
  });

  it('copes with a config that has no platform sections', () => {
    constants.expoConfig = { scheme: 'myapp' };

    expect(hostAppSchemes()).toEqual(['myapp']);
  });

  it("adds the development build's exp+ scheme, made from the slug as expo-dev-client does", () => {
    constants.expoConfig = { slug: 'My Shop_App!', scheme: 'myshop' };

    expect(hostAppSchemes()).toEqual(['myshop', 'exp+myshopapp']);
  });

  it('adds no development-build scheme for a slug with no usable characters', () => {
    constants.expoConfig = { slug: '!!!', scheme: 'myshop' };

    expect(hostAppSchemes()).toEqual(['myshop']);
  });
});
