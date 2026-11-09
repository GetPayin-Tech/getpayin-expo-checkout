import { beforeEach, describe, expect, it, vi } from 'vitest';

const linking = vi.hoisted(() => ({
  canOpenURL: vi.fn(),
  openURL: vi.fn(),
}));

vi.mock('react-native', () => ({ Linking: linking }));

import { openExternalLink } from '../src/webview/externalLink';

describe('openExternalLink', () => {
  beforeEach(() => {
    linking.canOpenURL.mockReset();
    linking.openURL.mockReset();
  });

  it('opens a bank app without asking canOpenURL first', () => {
    linking.openURL.mockResolvedValue(true);

    openExternalLink('mybank://authorise/3ds/9');

    expect(linking.openURL).toHaveBeenCalledWith('mybank://authorise/3ds/9');
    expect(linking.canOpenURL).not.toHaveBeenCalled();
  });

  it('swallows a link nothing on the phone can open', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    linking.openURL.mockRejectedValue(new Error('No activity found'));

    expect(() => openExternalLink('mybank://authorise/3ds/9')).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));

    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });
});
