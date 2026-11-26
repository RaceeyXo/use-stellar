# useOrderBook

Read and optionally poll the order book for a Stellar asset pair.

```ts
const book = useOrderBook({ selling: "XLM", buying: usdc, watch: true })
```

The composable shares its query key and error mapping with the React hook and remains idle during SSR.
