# Contributing

Thanks for helping with `@getpayin/expo-checkout`.

## Getting set up

```bash
npm install
npm run verify
```

`verify` runs eslint, markdownlint, prettier, the TypeScript compiler, the test suite with
coverage, the build, the dist smoke test and the package metadata check. CI runs the same
things, so a green `verify` is a green pipeline.

## Read this first

[`docs/architecture.md`](docs/architecture.md) explains how the package is laid out, which
layer may import what, why the components are deliberately thin, and why the two
deep-link sources are treated differently. Changing anything in `src/core`,
`src/webview` or `src/sessions` without reading it is how a silent payment bug gets in.

[`docs/security.md`](docs/security.md) explains the threat model the code is written
against, above all that the return link is attacker-controllable.

## Things that must never change

These are not style preferences. Each one has cost someone a working wallet or a leaked
secret, and `npm run smoke` fails the build on most of them:

1. No signing and no hash token in the app. The client's server signs
   `POST /api/integration/init` and hands the app only a `checkout_url`.
2. No `injectedJavaScript`, no `onMessage`, no script of any kind in the checkout web
   view. WebKit turns Apple Pay off on any page the host app has added scripts to, with no
   error.
3. No user-agent override. Google checks it and requires it to end with
   `GOOGLE_PAY_SUPPORTED`.
4. The app never treats the return link as proof of payment. A link the reader cannot
   understand is reported as `not_paid`, never `paid`.
5. The checkout's `iframe` mode is never used. It needs the integration's registered
   website as the page around it, and an app screen has none.
6. A script scheme never reaches `Linking.openURL`, and neither does the app's own scheme.
   `external` hands a URL to the phone and the page is what chose it.
7. The link the app was launched with never settles a checkout opened afterwards.

## Tests

Add a test with every behaviour change. The suite runs in Node with the native modules
mocked, and coverage over the pure and session layers is gated at 100% of statements,
functions and lines.

When you fix a bug, write the test that fails first. Several of the tests in this repo
exist because they caught a real one: `test/launchUrl.test.ts` and
`test/returnUrlSpoofing.test.ts` in particular.

What the suite cannot cover is the phone. Before a release, check by hand:

1. On an iPhone build: Apple Pay pays in the app's own screen and the app gets `paid`.
   Card with a 3-D Secure bank step works. Closing the screen gives `cancelled`.
2. On an Android build Google has approved, with `googlePayInApp: true`: Google Pay pays
   in the app's own screen.
3. On an Android build without approval, with `googlePayInApp: false`: the checkout opens
   in the browser sheet, Google Pay pays, and the app gets the result back.

## Documentation

The docs are split by job, and a change usually touches one of them:

| File                      | For                                                               |
| ------------------------- | ----------------------------------------------------------------- |
| `README.md`               | What it is, install, a quick start, and links out. Keep it short. |
| `docs/setup.md`           | Prerequisites and configuration.                                  |
| `docs/taking-payments.md` | The day-to-day integration.                                       |
| `docs/google-pay.md`      | The Android approval flow.                                        |
| `docs/api.md`             | Every export. Update it whenever the public surface changes.      |
| `docs/security.md`        | The threat model.                                                 |
| `docs/troubleshooting.md` | Symptom-first. Add to it whenever you learn a new silent failure. |
| `docs/architecture.md`    | For contributors.                                                 |

`npm run lint:md` must pass. It is part of `verify`.

## Commits and pull requests

Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`). Say what breaks if the change is
wrong. That is the part a reviewer cannot work out from the diff.

## Releasing

1. Update `CHANGELOG.md`.
2. Bump the version in `package.json`.
3. Tag `vX.Y.Z` and publish a GitHub release. The release workflow verifies that the tag
   matches `package.json`, runs `verify`, and publishes to npm with provenance.
