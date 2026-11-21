# Deep Links

Deep links handle signing flows where your app switches to a wallet app and returns via your app's URL scheme. This is common on mobile when opening an external wallet or payment app.

## Overview

When a user signs with WalletConnect, the flow is:

1. Your app calls `useSendPayment()` (or similar write hook)
2. The hook opens the wallet app
3. The user signs the transaction
4. The wallet returns to your app with the signed XDR

If the wallet app opens via a deep link instead of staying in the same process, you need to match the returning link to the original request using `registerPendingRequest()` and `initDeepLinkHandler()`.

## Setup

Import the deep-link handlers:

```tsx
import {
  initDeepLinkHandler,
  registerPendingRequest,
  parseDeepLink,
} from "@use-stellar/react-native"
```

## Initialize the Handler

Call `initDeepLinkHandler` once when your app starts, typically in a top-level effect:

```tsx
import { useEffect } from "react"
import { initDeepLinkHandler } from "@use-stellar/react-native"

export function App() {
  useEffect(() => {
    // Initialize deep-link handling on mount
    initDeepLinkHandler({
      onUnmatchedResult: (link: string) => {
        // A deep link arrived with no pending request
        // (app was killed or crashed while signing)
        console.warn("Orphaned deep link:", link)
        // Handle gracefully: show error, prompt user to retry
      },
    })
  }, [])

  return <MyApp />
}
```

The handler listens for incoming deep links for the lifetime of the app.

## Register a Request

When starting a signing flow that opens an external app, register the request:

```tsx
import { registerPendingRequest } from "@use-stellar/react-native"
import { uuid } from "expo-uuid" // or any unique ID generator

export async function signWithExternalApp() {
  const requestId = uuid() // must be unguessable
  const signedXdr = await registerPendingRequest(requestId)

  // At this point, the app has:
  // 1. Opened the external wallet app
  // 2. User signed there
  // 3. App returned with the signed XDR via deep link

  return signedXdr
}
```

`registerPendingRequest` returns a promise that resolves when the deep link returns with a matching request ID.

## Matching Requests to Links

The request ID must be unguessable — any app on the device can open your URL scheme, so the ID proves the returning link came from your outgoing request.

```tsx
// ✅ Good: cryptographically random
import { uuid } from "expo-uuid"
const requestId = uuid()

// ❌ Bad: guessable
const requestId = Math.random().toString()
const requestId = Date.now().toString()
```

Pass the request ID to the wallet app in your deep link:

```tsx
const walletDeepLink = `my-wallet://sign?requestId=${requestId}&xdr=${encodedXdr}`
await Linking.openURL(walletDeepLink)
```

The wallet app returns with:

```
myapp://sign?requestId=<same-id>&xdr=<signed-xdr>
```

The handler extracts the request ID and resolves the pending request.

## Parsing Deep Links

If you need to manually parse a deep link:

```tsx
import { parseDeepLink } from "@use-stellar/react-native"

const link = "myapp://sign?requestId=abc123&xdr=AxBf..."
const parsed = parseDeepLink(link)

console.log(parsed.requestId) // "abc123"
console.log(parsed.xdr) // "AxBf..."
```

## Handling Orphaned Results

If the app is killed (by the OS or user) while waiting for a signature, the returning deep link arrives with no pending request. The `onUnmatchedResult` handler is called:

```tsx
initDeepLinkHandler({
  onUnmatchedResult: (link: string) => {
    const { requestId, xdr } = parseDeepLink(link)

    // The original request is gone (app crashed, user killed it, etc.)
    // Options:
    // 1. Discard the result
    if (!xdr) {
      console.log("Signing was cancelled")
      return
    }

    // 2. Show a UI to retry
    showError("App was interrupted while signing. Please try again.")

    // 3. Save the orphaned result to persistent storage
    // and prompt the user on next app launch
    saveOrphanedSignature(requestId, xdr)
  },
})
```

Treat the orphaned link as untrusted input — validate the request ID and XDR format before using them.

## Example: Custom Wallet Integration

```tsx
import { useEffect, useState } from "react"
import { Button, Text, View } from "react-native"
import { Linking } from "react-native"
import { uuid } from "expo-uuid"
import {
  initDeepLinkHandler,
  registerPendingRequest,
  parseDeepLink,
} from "@use-stellar/react-native"

export function CustomWalletSigner() {
  const [status, setStatus] = useState("ready")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    initDeepLinkHandler({
      onUnmatchedResult: (link: string) => {
        console.warn("Orphaned deep link:", link)
        // Handle orphaned signature
      },
    })
  }, [])

  const handleSign = async (xdr: string) => {
    const requestId = uuid()
    setStatus("opening wallet")
    setError(null)

    try {
      // Open the wallet with the request ID
      const walletDeepLink = `stellar-expert://sign?requestId=${requestId}&xdr=${encodeURIComponent(
        xdr
      )}`
      await Linking.openURL(walletDeepLink)

      // Wait for the deep link to return with the signed XDR
      setStatus("waiting for signature")
      const signedXdr = await registerPendingRequest(requestId)

      setStatus("signed")
      console.log("Signed XDR:", signedXdr)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStatus("error")
    }
  }

  return (
    <View>
      <Text>Status: {status}</Text>
      {error && <Text>Error: {error}</Text>}
      <Button
        title="Sign Transaction"
        onPress={() =>
          handleSign(
            "AxBf6..." // actual XDR in your app
          )
        }
        disabled={status !== "ready"}
      />
    </View>
  )
}
```

## With WalletConnect

If you're using WalletConnect (recommended), deep-link handling is usually built in. However, if a WalletConnect wallet uses deep links as a fallback:

```tsx
import { useSendPayment } from "@use-stellar/react-native"
import { useEffect } from "react"
import { initDeepLinkHandler } from "@use-stellar/react-native"

export function SendPaymentWithDeepLinks() {
  const { send } = useSendPayment()

  useEffect(() => {
    initDeepLinkHandler({
      onUnmatchedResult: (link: string) => {
        // If signing via deep link fails and app is killed,
        // show user a way to recover
        showRecoveryUI(link)
      },
    })
  }, [])

  return (
    // Use send() as usual; WalletConnect handles deep links internally
    <Button title="Send" onPress={() => send(...)} />
  )
}
```

## See Also

- [Connecting Mobile Wallets](./mobile-wallets.md) — WalletConnect setup
- [Installation & Polyfills](./installation.md) — initial setup
