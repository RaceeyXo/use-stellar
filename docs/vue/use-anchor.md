# useAnchor

Resolve an anchor's `stellar.toml` through the shared query cache.

```ts
const { anchor, loading, error, refetch } = useAnchor({ homeDomain: domain })
```

`homeDomain` accepts a value, ref, or getter. Empty values disable the query. The returned values are computed refs and no request is made during server rendering.
