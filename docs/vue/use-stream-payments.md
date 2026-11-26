# useStreamPayments

Subscribe to live testnet payments while keeping a bounded newest-first buffer.

```ts
const { payments, connected, reconnect, clear } = useStreamPayments({ address })
```

Changing the address closes the previous stream. Scope disposal also closes the stream, and SSR never opens a connection.
