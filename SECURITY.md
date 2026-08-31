# Security Policy

## Supported versions

Only the latest version published to npm is actively supported with security fixes.

| Version | Supported |
| :------ | :-------- |
| Latest  | Yes       |
| Older   | No        |

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

This library builds and submits Stellar transactions that move real funds on
mainnet. Vulnerabilities that could cause fund loss, unauthorised transaction
signing, or private key exposure are taken seriously.

To report a vulnerability, email **security@use-stellar.dev** privately with:

- A clear description of the vulnerability
- Steps to reproduce it
- An assessment of the potential impact
- Any suggested fix or mitigation (optional but appreciated)

You will receive an acknowledgement within **48 hours** and a resolution
timeline within **7 days**.

Please do not disclose the issue publicly until a fix has been released and
you have been notified.

## Scope

In scope:

- Vulnerabilities that could cause loss of funds on mainnet
- Unauthorised transaction signing or submission
- Private key or secret exposure through the library

Out of scope (report via GitHub issues):

- Vulnerabilities that only affect the testnet demo app with no real-fund risk
- UI bugs or incorrect hook behaviour with no security impact

## Contact

security@use-stellar.dev

> Note: this address is a placeholder. Confirm the correct contact with the
> maintainers before reporting.
