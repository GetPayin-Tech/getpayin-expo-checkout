# Architecture

For anyone changing the package. If you only want to use it, you do not need this page.

## The shape of it

The decision-making is pure TypeScript with no React and no native module behind it. That
is deliberate: it is the part that decides whether a payment is reported correctly, and it
has to be testable without a phone.

```text
GetPayInCheckout.open()            src/checkout.ts        imports Platform, nothing else
  │
  ├─ resolvePresentation()         src/core/              pure: which presentation
  ├─ assertCheckoutUrl()           src/core/              pure: validation
  └─ SessionGuard                  src/core/              pure: one checkout at a time
        │
        ├── in-app ──▶ registry ──▶ GetPayInProvider      React
        │                             └─ GetPayInCheckoutView
        │                                  └─ createNavigationHandler()   pure
        │                                       ├─ classifyNavigation()   pure
        │                                       └─ resolveReturn()        pure
        │
        └── browser ─▶ runBrowserCheckout        expo-web-browser
                          ├─ watchForReturnUrl() expo-linking
                          └─ resolveReturn()     pure
```

| Layer      | Directory                         | May import                                      |
| ---------- | --------------------------------- | ----------------------------------------------- |
| Pure logic | `src/core`, `src/nativeIntent.ts` | nothing outside itself                          |
| Web view   | `src/webview`                     | `src/core`, and the two modules named below     |
| Sessions   | `src/sessions`                    | `expo-web-browser`, `expo-linking`              |
| React      | `src/components`                  | `react`, `react-native`, `react-native-webview` |
| Facade     | `src/checkout.ts`                 | `Platform` only                                 |

Two modules in `src/webview` reach a native module, and they are the only ones:
`externalLink.ts` imports `Linking` from `react-native`, and `appSchemes.ts` imports
`expo-constants`. Both are a single call wrapping a rule, both are mocked in the suite, and
both stay here rather than in a component so the rule around the call keeps its tests.
Nothing else in `src/core` or `src/webview` may import anything outside itself.

Keep that direction. A rule that moves out of `src/core` or `src/webview` and into a
component stops being testable, and these are rules that fail silently on a phone.

## One source of truth per rule

Both presentations are different ways of showing the same checkout, so anything that
decides what a payment _means_ lives in one place and is shared:

| Rule                         | Where                                 | Used by                                    |
| ---------------------------- | ------------------------------------- | ------------------------------------------ |
| What a return link means     | `core/returnUrl.ts` → `resolveReturn` | the in-app handler and the browser session |
| Where the checkout is drawn  | `core/presentation.ts`                | `checkout.ts`                              |
| What to do with a navigation | `core/navigation.ts`                  | `webview/navigationHandler.ts`             |
| The web view settings        | `webview/platformProps.ts`            | `components/GetPayInCheckoutView.tsx`      |
| One checkout at a time       | `core/sessionGuard.ts`                | `checkout.ts`                              |

If you find yourself writing a second copy of one of these, that is the bug.

## Why the components are thin

`GetPayInCheckoutView` and `GetPayInProvider` hold almost no logic. What they had was
moved into `webview/navigationHandler.ts` and `sessions/sessionHost.ts`, which are plain
factories with no React in them. That is what lets the suite cover the session lifecycle
and the navigation decisions in Node.

Two React details in there are load-bearing, not style:

1. **The navigation handler is keyed to a `session` object, not to the callbacks.** The
   handler completes at most once, so it must be rebuilt when the checkout changes — and
   must _not_ be rebuilt because the caller passed a fresh inline `onComplete`, which would
   reset the latch and report one payment twice. The callbacks reach it through a ref.
2. **A failed load always shows the top bar.** Otherwise a checkout that cannot load with
   `headerShown: false` is a blank modal with no way out on iOS, the `open()` promise never
   settles, and the session guard reports busy for the rest of the process.

## Two deep-link sources, treated differently

`sessions/deepLink.ts` reads the return link from two places, and the asymmetry is the
point:

- The **`url` event** is a push. The system delivers each link once, as it happens. A
  watcher only has to ignore a second copy of its own.
- **`getInitialURL()`** is a pull of state that persists. It keeps returning the same link
  for as long as the activity's intent holds it. Values from it are therefore consumed once
  per process, and the link the app was _launched_ with is consumed before any checkout can
  start — it belongs to no session, and letting a later checkout read it would report a
  payment that never happened.

Getting this wrong is not a style question: it is how a forged link that cold-starts the
app becomes the next checkout's `paid`.

## Testing

```bash
npm run verify
```

That runs eslint, markdownlint, prettier, the TypeScript compiler, the suite with
coverage, the build, the dist smoke test and the package metadata check. CI runs the same
things.

The suite runs in Node with the native modules mocked. Coverage over the pure and session
layers is gated at 100% of statements, functions and lines.

`scripts/smoke-dist.mjs` checks the shipped bytes rather than importing them, because the
bundle only resolves inside Metro. It fails the build if a signing secret, an injected
script, a bridge or a user-agent override ever appears, or if a wallet setting disappears.
Each of those fails silently on a phone, which is why it is a build gate rather than a
review note.

What the suite cannot cover is the phone itself. [`CONTRIBUTING.md`](../CONTRIBUTING.md)
lists the by-hand checks to run before a release.

## House style

1. **Docblocks on every declaration**, saying why the code is the way it is when the reason
   is not obvious from the name. `src/webview/platformProps.ts` is the clearest example:
   each setting fails silently when wrong, so each one says what breaks.
2. **No comments inside function bodies.** A body that needs explaining wants a named
   helper or a docblock, not a running commentary.
3. Prettier and eslint settle the rest.
