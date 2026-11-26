# useSep10Auth

Authenticate with a SEP-10 anchor using the wallet configured on the Vue runtime.

```ts
const auth = useSep10Auth({ homeDomain: "testanchor.stellar.org" })
const token = await auth.authenticate()
```

The token is returned to the caller and kept only in the composable scope. It is never written to local storage automatically. Expired challenges, invalid anchors, wallet rejection, and network failures use the same typed errors as React.
