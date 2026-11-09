import { readFileSync } from 'node:fs';
import process from 'node:process';

/*
 * The built package cannot be imported in plain Node: it is React Native code and its
 * imports resolve only inside Metro. What can be checked here, and what matters most, is
 * that the shipped bytes still hold to the rules the wallets and the security model
 * depend on. Every one of these fails silently on a phone, so it is checked on every
 * build instead.
 */

const BUNDLES = ['dist/index.js', 'dist/index.cjs'];
const TYPES = ['dist/index.d.ts', 'dist/index.d.cts'];

/** Tokens that must never reach the app bundle. */
const FORBIDDEN = [
  {
    pattern: /hashToken|hash_token|createHmac|timingSafeEqual/,
    why: 'the app must hold no signing secret and must sign nothing',
  },
  {
    pattern: /from\s*["']node:crypto["']|require\(["']node:crypto["']\)|require\(["']crypto["']\)/,
    why: 'React Native has no node:crypto, and needing it would mean signing moved into the app',
  },
  {
    pattern: /injectedJavaScript/,
    why: 'WebKit turns Apple Pay off on any page the host app has added scripts to',
  },
  {
    pattern: /onMessage\s*[:=]/,
    why: 'a page-to-app bridge counts as an injected script on iOS and disables Apple Pay',
  },
  {
    pattern: /userAgent\s*[:=]|applicationNameForUserAgent/,
    why: 'Google checks the user agent and requires it to end with GOOGLE_PAY_SUPPORTED',
  },
  {
    pattern: /iframe\s*:\s*(true|1)/,
    why: "the checkout's iframe mode needs a registered website, which an app screen has none of",
  },
];

/** Settings the wallets stop working without. */
const REQUIRED = [
  { pattern: /originWhitelist/, why: 'the view must be handed the return link itself' },
  { pattern: /enableApplePay/, why: 'Apple Pay needs it on iOS' },
  { pattern: /paymentRequestEnabled/, why: 'Google Pay in a web view needs it on Android' },
];

/** Peers that must stay external so the host app's single copy is the one used. */
const EXTERNALS = ['react-native', 'react-native-webview', 'expo-web-browser', 'expo-linking'];

/** Public names the type declarations must carry. */
const EXPORTS = [
  'GetPayInCheckout',
  'GetPayInProvider',
  'GetPayInCheckoutView',
  'createPaymentReturnRedirect',
  'CheckoutResult',
  'OpenCheckoutOptions',
];

const failures = [];

/** Records a failed expectation against a file. */
function fail(file, message) {
  failures.push(`${file}: ${message}`);
}

/** Reads a built file, recording a failure when it is missing. */
function read(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    fail(file, 'missing from dist — run `npm run build`');

    return undefined;
  }
}

for (const file of BUNDLES) {
  const source = read(file);

  if (source === undefined) {
    continue;
  }

  for (const { pattern, why } of FORBIDDEN) {
    if (pattern.test(source)) {
      fail(file, `contains ${pattern} — ${why}`);
    }
  }

  for (const { pattern, why } of REQUIRED) {
    if (!pattern.test(source)) {
      fail(file, `is missing ${pattern} — ${why}`);
    }
  }

  for (const peer of EXTERNALS) {
    if (!source.includes(`"${peer}"`)) {
      fail(file, `does not import ${peer} — it may have been bundled instead of left external`);
    }
  }
}

for (const file of TYPES) {
  const source = read(file);

  if (source === undefined) {
    continue;
  }

  for (const name of EXPORTS) {
    if (!source.includes(name)) {
      fail(file, `does not declare ${name}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Smoke test failed:');

  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }

  process.exit(1);
}

console.log(
  `Smoke test passed: ${BUNDLES.length} bundles and ${TYPES.length} declaration files hold to ` +
    `${FORBIDDEN.length} forbidden patterns, ${REQUIRED.length} required settings, ` +
    `${EXTERNALS.length} externals and ${EXPORTS.length} public names.`,
);
