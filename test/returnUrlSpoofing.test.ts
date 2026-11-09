import { describe, expect, it } from 'vitest';

import { classifyNavigation } from '../src/core/navigation';
import { matchesReturnUrl, readCheckoutResult } from '../src/core/returnUrl';
import { CheckoutStatus } from '../src/types';

/*
 * Any app or web page on the phone can invoke the return scheme with whatever query it
 * likes, and a compromised checkout page can drive the web view at any URL it likes.
 * These are the shapes that would be worth trying: a near-miss host that the matcher
 * might accept, and a status the reader might upgrade to paid.
 */

const RETURN_URL = 'myapp://payment-return';

describe('a forged link must not pass as the return link', () => {
  it.each([
    ['userinfo before the real host', 'myapp://payment-return@evil.example.com'],
    ['the host as userinfo of another', 'myapp://evil.example.com@payment-return.evil'],
    ['a longer host with the same prefix', 'myapp://payment-return.evil.example.com'],
    ['a host the return host is a suffix of', 'myapp://evil-payment-return'],
    ['an extra path segment', 'myapp://payment-return/../payment-return/evil'],
    ['a deeper path', 'myapp://payment-return/evil'],
    ['another scheme entirely', 'https://payment-return'],
    ['a scheme that contains the real one', 'notmyapp://payment-return'],
    ['a port on the authority', 'myapp://payment-return:8080'],
    ['backslashes instead of slashes', 'myapp:\\\\payment-return'],
    ['a percent-encoded host', 'myapp://payment%2Dreturn'],
    ['an empty authority with the host in the path', 'myapp:///payment-return'],
  ])('rejects %s', (_label, url) => {
    expect(matchesReturnUrl(url, RETURN_URL)).toBe(false);
  });

  it('still accepts the genuine link with a query and fragment', () => {
    expect(matchesReturnUrl('myapp://payment-return?success=1#x', RETURN_URL)).toBe(true);
  });
});

describe('a forged link must not read as paid', () => {
  it.each([
    ['an empty success flag', 'myapp://payment-return?success='],
    ['a success flag of its own invention', 'myapp://payment-return?success=yes'],
    ['no parameters at all', 'myapp://payment-return'],
    ['a flag buried in another key', 'myapp://payment-return?note=success%3D1'],
    ['a status field GetPayIn never sends', 'myapp://payment-return?status=paid'],
    ['a state field GetPayIn never sends', 'myapp://payment-return?state=approved'],
    ['a success array suffix', 'myapp://payment-return?success[]=1'],
  ])('does not report %s as paid', (_label, url) => {
    expect(readCheckoutResult(url).status).not.toBe(CheckoutStatus.Paid);
  });

  it('does not let a later repeated flag overwrite the first', () => {
    expect(readCheckoutResult('myapp://payment-return?success=0&success=1').status).toBe(
      CheckoutStatus.NotPaid,
    );
  });

  it('does not let a status field overrule the success flag', () => {
    expect(readCheckoutResult('myapp://payment-return?status=paid&success=0').status).toBe(
      CheckoutStatus.NotPaid,
    );
  });
});

describe('a hostile navigation must not reach the phone as an app link', () => {
  it.each([
    'javascript:alert(document.cookie)',
    'JaVaScRiPt:alert(1)',
    'file:///etc/passwd',
    'data:text/html,<script>alert(1)</script>',
  ])('keeps %s inside the web view rather than handing it to the phone', (url) => {
    expect(classifyNavigation(url, RETURN_URL)).not.toBe('external');
  });
});
