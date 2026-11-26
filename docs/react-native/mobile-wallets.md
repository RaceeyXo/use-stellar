# Connecting Mobile Wallets

React Native only supports WalletConnect for signing transactions. Browser-based wallets (Freighter, Albedo) are not available on native platforms.

## WalletConnect Overview

WalletConnect enables your app to communicate with external wallet apps on the user's device. When the user signs a transaction, your app pauses and opens the wallet app. After signing, the wallet returns control to your app with the signed XDR.

Supported Stellar wallets include Stellar Expert Wallet and other WalletConnect-compatible signers that support the Stellar mainnet and testnet.

## Installation

WalletConnect requires two packages:

```bash
npm install @walletconnect/sign-client @walletconnect/react-native-compat
# or: pnpm add @walletconnect/sign-client @walletconnect/react-native-compat
```

If building with Expo, create a development build (Expo Go does not support native modules):

```bash
eas build --platform ios --profile preview
# or build for Android
eas build --platform android --profile preview
```

## Project ID

You need a WalletConnect project ID from [cloud.walletconnect.com](https://cloud.walletconnect.com):

1. Sign up or log in to WalletConnect Cloud
2. Create a new project
3. Copy your Project ID

## Configuration

Pass WalletConnect config to `StellarProvider`:

```tsx
import { StellarProvider } from "@use-stellar/react-native"

const walletConnect = {
  projectId: "YOUR_PROJECT_ID", // from https://cloud.walletconnect.com
  metadata: {
    name: "My app",
    description: "What my app does",
    url: "https://myapp.example",
    icons: ["https://myapp.example/icon.png"],
  },
}

export default function App() {
  return (
    <StellarProvider network="testnet" walletConnect={walletConnect}>
      <MyApp />
    </StellarProvider>
  )
}
```

The `metadata` object tells wallets how to identify and display your app:
- `name` — app name (shown in wallet approval screen)
- `description` — brief description of your app
- `url` — your app's website
- `icons` — app icon URLs (at least 240x240px)

## Connecting a Wallet

Use the `useWallet` hook to connect WalletConnect:

```tsx
import { useWallet } from "@use-stellar/react-native"
import { Button, Text, View } from "react-native"

export function ConnectWallet() {
  const { connected, connecting, address, error, connect, disconnect } = useWallet()

  if (connecting) {
    return <Text>Connecting...</Text>
  }

  if (connected) {
    return (
      <View>
        <Text>Connected: {address}</Text>
        <Button title="Disconnect" onPress={disconnect} />
      </View>
    )
  }

  return (
    <View>
      <Button
        title="Connect Wallet"
        onPress={() => connect("walletconnect")}
        disabled={connecting}
      />
      {error && <Text>{error.message}</Text>}
    </View>
  )
}
```

## Pairing

The first time the user connects, a pairing link is generated. You can:

1. **Open it automatically** (opens the wallet app directly):
   ```tsx
   const { connect } = useWallet()
   await connect("walletconnect")
   ```

2. **Display it as a QR code** (user scans it):
   ```tsx
   import { useWallet } from "@use-stellar/react-native"

   const { connect } = useWallet()

   const onPairingUri = (uri: string) => {
     // Display uri as QR code or in text form
     console.log("Scan this:", uri)
   }

   await connect("walletconnect", { onPairingUri })
   ```

3. **Open it custom** (e.g., copy to clipboard):
   ```tsx
   const onPairingUri = (uri: string) => {
     // Copy to clipboard, send via email, etc.
     Clipboard.setString(uri)
   }

   await connect("walletconnect", { onPairingUri })
   ```

With `autoConnect` enabled, an approved session is reused on the next app launch instead of pairing again.

## Signing Transactions

Once connected, use any write hook to sign transactions. The wallet app opens, the user approves, and the hook returns the result:

```tsx
import { useSendPayment } from "@use-stellar/react-native"
import { Button, TextInput, View } from "react-native"
import { useState } from "react"

export function SendPayment() {
  const { send, loading, error, result } = useSendPayment()
  const [destination, setDestination] = useState("")
  const [amount, setAmount] = useState("1")

  const handleSend = async () => {
    try {
      await send({
        to: destination,
        asset: "XLM",
        amount,
      })
    } catch (err) {
      console.error("Send failed:", err)
    }
  }

  return (
    <View>
      <TextInput
        placeholder="Destination address"
        value={destination}
        onChangeText={setDestination}
      />
      <TextInput
        placeholder="Amount"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />
      <Button title="Send" onPress={handleSend} disabled={loading} />
      {error && <Text>Error: {error.message}</Text>}
      {result && <Text>Sent: {result.hash}</Text>}
    </View>
  )
}
```

Write hooks automatically handle:
- Opening the wallet app
- Showing the transaction for user approval
- Waiting for the signed XDR
- Building and submitting the transaction

## Networks

WalletConnect on Stellar supports:
- `testnet` — for development and testing
- `mainnet` — for production

Your `StellarProvider` network prop controls which network the app connects to. The wallet must be switched to the same network, or the signature will be rejected.

## Disconnecting

Call the `disconnect` function to clear the session:

```tsx
const { disconnect } = useWallet()

<Button title="Disconnect" onPress={disconnect} />
```

The pairing remains on the wallet side, so the user can reconnect quickly without scanning a new QR code.

## Handling Long Signing Flows

If your signing flow switches to another app and comes back via a deep link, use deep-link handling. See [Deep Links](./deep-links.md) for details.

## Error Handling

Common errors:

| Error | Meaning | Solution |
| --- | --- | --- |
| `wallet_unavailable` | WalletConnect packages not installed | Install `@walletconnect/sign-client` and `@walletconnect/react-native-compat` |
| `network_mismatch` | Wallet is on a different network | Switch wallet to match app's network |
| `user_rejected` | User declined to sign | Respect the user's choice; let them try again |
| `invalid_address` | Destination account doesn't exist | Use a funded testnet account or enable account creation |

## Example: Complete Wallet Integration

```tsx
import { StellarProvider, useWallet, useSendPayment } from "@use-stellar/react-native"
import { Button, Text, TextInput, View } from "react-native"
import { useState } from "react"

const walletConnect = {
  projectId: "YOUR_PROJECT_ID",
  metadata: {
    name: "My Stellar App",
    description: "Send and receive XLM",
    url: "https://myapp.example",
    icons: ["https://myapp.example/logo.png"],
  },
}

function WalletApp() {
  const wallet = useWallet()
  const send = useSendPayment()
  const [destination, setDestination] = useState("")
  const [amount, setAmount] = useState("1")

  if (!wallet.connected) {
    return (
      <View>
        <Text>Not connected</Text>
        <Button
          title="Connect Wallet"
          onPress={() => wallet.connect("walletconnect")}
          disabled={wallet.connecting}
        />
      </View>
    )
  }

  return (
    <View>
      <Text>Connected: {wallet.address}</Text>
      <TextInput
        placeholder="Destination"
        value={destination}
        onChangeText={setDestination}
      />
      <TextInput
        placeholder="Amount"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />
      <Button
        title="Send XLM"
        onPress={() =>
          send.send({
            to: destination,
            asset: "XLM",
            amount,
          })
        }
        disabled={send.loading}
      />
      <Button title="Disconnect" onPress={wallet.disconnect} />
    </View>
  )
}

export default function App() {
  return (
    <StellarProvider network="testnet" walletConnect={walletConnect} autoConnect>
      <WalletApp />
    </StellarProvider>
  )
}
```

## See Also

- [Provider Props](./provider-props.md) — configure WalletConnect
- [Deep Links](./deep-links.md) — handle signing flows that return via deep links
- [Installation & Polyfills](./installation.md) — install required packages
