# End-to-End Smoke Tests

Maestro end-to-end tests for the React Native Expo example on testnet.

## Setup

Install [Maestro CLI](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli.md):

```bash
brew install mobile-dev-tools/tap/maestro
# or
curl -Ls "https://get.maestro.dev" | bash
```

## Running locally

Start an Android emulator or iOS simulator, then run the smoke test:

```bash
maestro test smoke.yaml
```

To run with a specific device:

```bash
maestro --device=DEVICE_ID test smoke.yaml
```

List available devices:

```bash
maestro list-devices
```

## CI/CD

The smoke test runs nightly and on manual dispatch via GitHub Actions. See `.github/workflows/e2e.yml`.

## Test coverage

**smoke.yaml** verifies:

- App launches without crashing
- Main heading "use-stellar Expo (testnet)" is visible
- Navigation tabs are present (Wallet, Balance, History, Send)
- Balance screen loads and displays account information
- No red box or polyfill import errors

This catches bugs hidden by Jest mocks: Metro resolution errors, polyfill-order issues, Hermes globals, and native module linking.
