# useOffers

Read an account's open DEX offers with shared caching and pagination.

```ts
const { offers, fetchNext, fetchPrev } = useOffers({ address, limit: 20 })
```

The connected wallet address is used when `address` is omitted. All options may be reactive.
