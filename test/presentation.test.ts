import { describe, expect, it } from 'vitest';

import { resolvePresentation } from '../src/core/presentation';

describe('resolvePresentation', () => {
  it('always uses the app screen on iOS, where Apple Pay lives', () => {
    expect(resolvePresentation({ platform: 'ios' })).toBe('in-app');
  });

  it('keeps the app screen on iOS even when googlePayInApp is off', () => {
    expect(resolvePresentation({ platform: 'ios', googlePayInApp: false })).toBe('in-app');
  });

  it('sends Android to the browser sheet before Google approves the app', () => {
    expect(resolvePresentation({ platform: 'android' })).toBe('browser');
  });

  it('treats an explicit false on Android the same as the default', () => {
    expect(resolvePresentation({ platform: 'android', googlePayInApp: false })).toBe('browser');
  });

  it('uses the app screen on Android once the client turns googlePayInApp on', () => {
    expect(resolvePresentation({ platform: 'android', googlePayInApp: true })).toBe('in-app');
  });

  it('falls back to the browser sheet on any other platform', () => {
    expect(resolvePresentation({ platform: 'web' })).toBe('browser');
  });

  it('lets an override win over the platform rule', () => {
    expect(resolvePresentation({ platform: 'ios', override: 'browser' })).toBe('browser');
    expect(resolvePresentation({ platform: 'android', override: 'in-app' })).toBe('in-app');
  });
});
