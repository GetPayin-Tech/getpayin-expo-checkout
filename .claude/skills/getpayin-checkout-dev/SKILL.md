---
name: getpayin-checkout-dev
description: Work on the @getpayin/expo-checkout package itself — its layering rules, the settings that fail silently on a phone, the invariants the build enforces, and the verify loop. Use when editing, reviewing or testing files under src/core, src/webview, src/sessions, src/components or src/checkout.ts in the getpayin-expo-checkout repository, when adding an export or option to it, or when a change touches the return-link reader, the presentation rule, the navigation classifier or the deep-link watcher.
---

# Working on @getpayin/expo-checkout

This is the maintainer's skill for the package itself. For integrating it into an app, use
`getpayin-expo-checkout` instead.

## Before changing anything

Read [`docs/architecture.md`](../../../docs/architecture.md) and
[`docs/security.md`](../../../docs/security.md). Everything below is a summary of those
two; they carry the reasoning.

## Layering

| Layer      | Directory                         | May import                                      |
| ---------- | --------------------------------- | ----------------------------------------------- |
| Pure logic | `src/core`, `src/nativeIntent.ts` | nothing outside itself                          |
| Web view   | `src/webview`                     | `src/core`, plus the two exceptions below       |
| Sessions   | `src/sessions`                    | `expo-web-browser`, `expo-linking`              |
| React      | `src/components`                  | `react`, `react-native`, `react-native-webview` |
| Facade     | `src/checkout.ts`                 | `Platform` only                                 |

The two exceptions in `src/webview` are `externalLink.ts` (`Linking` from `react-native`)
and `appSchemes.ts` (`expo-constants`). Each is one call wrapping a rule, each is mocked in
the suite, and both stay there rather than in a component so the rule keeps its tests. Do
not add a third without a reason that good.

Keep that direction. Moving a rule out of `src/core` or `src/webview` into a component
makes it untestable, and these are rules that fail silently on a phone rather than
throwing.

## One source of truth per rule

Both presentations show the same checkout, so anything deciding what a payment _means_
lives once:

| Rule                         | Where                                 |
| ---------------------------- | ------------------------------------- |
| What a return link means     | `core/returnUrl.ts` → `resolveReturn` |
| Where the checkout is drawn  | `core/presentation.ts`                |
| What to do with a navigation | `core/navigation.ts`                  |
| The web view settings        | `webview/platformProps.ts`            |
| One checkout at a time       | `core/sessionGuard.ts`                |

Writing a second copy of one of these is the bug. Both the in-app handler and the browser
session must go through `resolveReturn`, or they will drift on what a link means.

## Invariants the build enforces

`npm run smoke` greps the shipped bundles and fails the build on any of these. Do not work
around it — the gate is the point.

1. No `hashToken`, `createHmac`, `timingSafeEqual` or `node:crypto`. The app signs nothing.
2. No `injectedJavaScript`, no `injectedJavaScriptBeforeContentLoaded`, no `onMessage`.
   WebKit turns Apple Pay off on any page the host app has scripted — on every platform, so
   not "iOS only".
3. No `userAgent` or `applicationNameForUserAgent`. Google checks it and requires it to end
   with `GOOGLE_PAY_SUPPORTED`.
4. No `iframe: true`.
5. `originWhitelist`, `enableApplePay` and `paymentRequestEnabled` must all still be
   present.
6. `react-native`, `react-native-safe-area-context`, `react-native-webview`,
   `expo-web-browser`, `expo-linking` and `expo-constants` stay external, so the host app's
   single copy is the one used.

## Invariants only review catches

1. **A return link is never upgraded to `paid`.** Unknown or absent status must become
   `not_paid`. Check this on any change to `core/returnUrl.ts`.
2. **The launch link never settles a later checkout.** `getInitialURL()` is a _pull_ of
   persistent state and its values are consumed once per process; the `url` event is a
   _push_ and is not deduplicated across sessions. Do not collapse the two — the asymmetry
   is what stops a forged cold-start link becoming the next checkout's `paid`, while still
   letting a byte-identical link settle a second genuine checkout.
3. **`expectedInvoiceId` downgrades only `paid`.** Rewriting a `not_paid` or `cancelled`
   would lose the reason the payer was given.
4. **A script scheme, any scheme the app answers to, and anything with no part in paying
   never reach `Linking.openURL`.** `classifyNavigation` must return `block` for all three;
   the app's schemes come from `hostAppSchemes()` (app config schemes, an Android intent
   filter's, `CFBundleURLTypes`, iOS bundle identifier, Android package, `exp+<slug>`), and
   `REFUSED_APP_SCHEMES` holds the rest. `external` hands a URL to the phone and the page —
   which may be issuer-hosted, not GetPayIn's — is what chose it.
5. **A frame inside the checkout page can only ever `load`.** `isTopFrame` is required, not
   defaulted: a 3-D Secure page knows the real invoice id, so an `<iframe>` aimed at the
   return link would report a payment nobody made, and `expectedInvoiceId` is no defence.
6. **Both sides of an invoice comparison go through `core/invoiceId.ts`.** The server sends
   a number and the link carries text; comparing them as they arrive reports every paid
   checkout as `not_paid`.
7. **A payer never sees developer text.** `buildCheckoutSource`'s `error` names an option
   and its value — it goes to `onLoadError`'s second argument, and the payer gets
   `loadErrorMessage`. Blank option text falls back through `core/text.ts`, because
   `t('key')` with a missing key returns `''` and `??` would keep it.
8. **The navigation handler is keyed to the session, not the callbacks.** It completes at
   most once; rebuilding it on a fresh inline `onComplete` resets that latch and reports one
   payment twice. Rebuilding it only when the checkout changes is required.
9. **A failed load always shows a way out.** Otherwise the `open()` promise never settles
   and `SessionGuard` reports busy for the rest of the process.

## House style

1. **Docblocks on every declaration**, saying why when the reason is not obvious from the
   name. `webview/platformProps.ts` is the model: each setting says what breaks.
2. **No comments inside function bodies.** Extract a named helper instead. A block comment
   above a declaration, or a file header, is fine.
3. Explicit return types, `type` imports separated, no `console`, `eqeqeq`, braces always.
   eslint enforces these.

## The loop

```bash
npm run verify
```

eslint → markdownlint → prettier → tsc → vitest with coverage → build → smoke → publint.
CI runs the same, so a green `verify` is a green pipeline.

Narrow while iterating:

```bash
npx vitest run test/returnUrl.test.ts
npx vitest run --coverage
npm run smoke
```

Coverage over `src/core`, `src/webview`, `src/sessions`, `src/checkout.ts`,
`src/nativeIntent.ts` and `src/errors.ts` is gated at **100% of statements, functions and
lines** and 95% of branches. A new pure function needs tests in the same change.

## Adding to the public surface

1. Add the type to `src/types.ts` with a docblock.
2. Thread it through `core/returnUrl.ts` if it affects what a link means, so both
   presentations get it.
3. Export it from `src/index.ts`.
4. Add it to `docs/api.md` — the reference is expected to be complete.
5. Add it to `scripts/smoke-dist.mjs`'s `EXPORTS` list if it is a headline export.
6. Note it in `CHANGELOG.md`.

## Testing notes

- The suite runs in Node. `react-native`, `expo-constants`, `expo-web-browser` and
  `expo-linking` are mocked with `vi.hoisted` + `vi.mock`; see `test/checkout.test.ts`,
  `test/appSchemes.test.ts` and `test/browserSession.test.ts`.
- There are no component render tests. React 19 deprecated `react-test-renderer`, so the
  logic was moved into `webview/navigationHandler.ts` and `sessions/sessionHost.ts`
  instead. Put new component logic there rather than adding a render harness.
- `test/launchUrl.test.ts` imports the deep-link module fresh per test with
  `vi.resetModules()`, because the launch URL is read at module load. Keep that pattern for
  anything that depends on module-load order.
- When fixing a bug, write the failing test first. `test/launchUrl.test.ts` and
  `test/returnUrlSpoofing.test.ts` exist because they caught real ones.

## Before a release

The suite cannot test a phone. Run the by-hand checks in
[`CONTRIBUTING.md`](../../../CONTRIBUTING.md): Apple Pay in the app screen on iOS, a 3-D
Secure card step, close giving `cancelled`, Google Pay in the app screen on an approved
Android build, and Google Pay in the browser sheet on an unapproved one.
