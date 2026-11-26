# useFriendBot

Fund a testnet or futurenet account through the shared core action.

```ts
const { fund, funded, loading, error } = useFriendBot()
await fund(address.value)
```

The connected wallet address is used when no address is passed. Mainnet calls fail with a typed validation error, and a successful request invalidates the shared account cache.
