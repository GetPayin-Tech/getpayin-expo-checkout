## What this changes

<!-- One or two sentences. -->

## Why

<!-- What breaks, or stays broken, without it. -->

## Checklist

- [ ] `npm run verify` passes.
- [ ] Tests cover the behaviour change.
- [ ] No signing, secret or hash token reaches the app.
- [ ] No `injectedJavaScript`, `onMessage` or other script added to the checkout web view.
- [ ] No user-agent override on the web view.
- [ ] `CHANGELOG.md` updated if this is user-visible.

## Checked on a phone

<!-- Delete the rows you did not check, and say which build and OS version. -->

- [ ] iPhone: Apple Pay pays in the app's own screen.
- [ ] iPhone: card with a 3-D Secure bank step.
- [ ] iPhone: closing the screen reports `cancelled`.
- [ ] Android with `googlePayInApp: true`: Google Pay pays in the app's own screen.
- [ ] Android with `googlePayInApp: false`: Google Pay pays in the browser sheet.
