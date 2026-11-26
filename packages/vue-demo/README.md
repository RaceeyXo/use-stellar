# use-stellar Vue demo

A small wallet app on Stellar **testnet**, built from the `@use-stellar/vue` composables. It is the quickest way to see the package work end to end, and it uses test money only.

## Run it

From the repository root:

```bash
pnpm install
pnpm build:lib          # the demo uses the built packages
pnpm --filter @use-stellar/vue-demo dev
```

Vite prints a local address, by default <http://localhost:5173>.

To build it the way CI does:

```bash
pnpm --filter @use-stellar/vue-demo build
```

## What you need

- A browser wallet set to **testnet**. [Freighter](https://www.freighter.app/) is the one the demo is checked with; Rabet also works.
- A testnet account. If the connected account does not exist yet, the "Balance and account" section offers a Friendbot button that creates it with test XLM.

### WalletConnect (optional)

WalletConnect needs a project id from <https://cloud.reown.com>. Put it in `packages/vue-demo/.env.local`, which is not committed:

```bash
VITE_WALLETCONNECT_PROJECT_ID=your-project-id
```

Without it the demo still runs. The WalletConnect button is shown but turned off, and says why.

## What it shows

| Section | Composable | What it does |
| --- | --- | --- |
| Wallet | `useDemoWallet` (see below) | Connect and disconnect Freighter, Rabet or WalletConnect; warns when the wallet is on another network |
| Balance and account | `useAccountExists`, `useBalance`, `useFriendBot` | Whether the account exists, its XLM balance and every other balance, and Friendbot funding |
| Payment history | `usePaymentHistory` | The account's payments, five to a page, with newer and older pages |
| Send payment | `useSendPayment` | Sends test XLM, with an optional memo |
| Add trustline | `useAddTrustline` | Adds a trustline; the form starts with testnet USDC |
| Soroban read | `useSorobanContract` | Simulates a read-only contract method; nothing is signed |

The read sections show the connected wallet's account. Type another testnet address to look at that one.

## The wallet composable

`@use-stellar/vue` does not have a `useWallet` composable yet (issue #474). Until it does, `src/composables/useDemoWallet.ts` does the wiring the package README describes: it connects through a core wallet adapter and hands the result to `runtime.setWallet`, so the write composables sign with that wallet. It returns the same names issue #474 plans for `useWallet`, so replacing it is one import. It does not remember the wallet between page loads.

## Testnet only

The plugin is created with `network: "testnet"`, the explorer links point at the testnet explorer, and the only address in the source is the testnet USDC issuer. Nothing is signed unless the wallet is on testnet too.
