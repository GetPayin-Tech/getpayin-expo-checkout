import { describe, expect, it } from 'vitest';

import {
  GetPayInCheckoutError,
  GetPayInConfigError,
  GetPayInProviderMissingError,
  GetPayInSessionBusyError,
} from '../src/errors';

describe('errors', () => {
  it.each([
    [new GetPayInConfigError('bad'), 'GetPayInConfigError'],
    [new GetPayInProviderMissingError(), 'GetPayInProviderMissingError'],
    [new GetPayInSessionBusyError(), 'GetPayInSessionBusyError'],
  ])('names %s after its class and extends the base error', (error, name) => {
    expect(error.name).toBe(name);
    expect(error).toBeInstanceOf(GetPayInCheckoutError);
    expect(error.message).not.toBe('');
  });
});
