# Security Policy

## Reporting a vulnerability

Please do not open a public issue for a security problem. Report it privately through
GitHub's [security advisory form](https://github.com/GetPayin-Tech/getpayin-expo-checkout/security/advisories/new),
or email <security@getpayin.com>. We aim to acknowledge a report within three working
days.

Include what you can: the package version, the phone and OS version, what you observed,
and the smallest reproduction you have. Please do not include real card numbers, real
payer details or live credentials.

## Supported versions

The latest minor release receives security fixes. The package is pre-1.0, so fixes land
on the current line rather than being backported.

## The threat model

[`docs/security.md`](docs/security.md) is the full account: what the package guarantees,
what it cannot, and what your server must do. The short version follows.

## What this package is responsible for

The package opens the hosted GetPayIn checkout and reports what the return link said. It
holds no secret, signs nothing and stores nothing.

1. **No credentials in the app.** The hash token belongs on your server, which signs
   `POST /api/integration/init` and hands the app only a `checkout_url`. If you find a
   path by which this package could see or transmit a signing secret, that is a
   vulnerability — report it.
2. **Card details never reach your app or ours.** The payer enters them on the hosted
   checkout, inside CyberSource's own frames. The package adds no script to that page, so
   it has no way to read them.
3. **The result is not an authorisation.** `status: 'paid'` reports what the return link
   claimed. Anyone can open an app with a made-up return link, so your server must
   confirm the `invoice.paid` webhook before fulfilling an order. The package reports an
   unreadable return link as `not_paid` for this reason, and will never upgrade an
   ambiguous result to `paid`.

## Your side of the line

1. Keep your hash token on your server, out of the app bundle, out of version control and
   out of any client-side configuration.
2. Confirm every payment server-side before delivering anything.
3. Set the **Mobile App Return Scheme** on the integration to your app's own scheme, and
   keep it specific to your app.
4. Use a development or store build. Expo Go cannot receive your app's return link.
