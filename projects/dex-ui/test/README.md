# Basin guest browsing regression tests

From the repository root, install dependencies and build the SDKs once:

```sh
node .yarn/releases/yarn-4.1.0.cjs install --immutable
node .yarn/releases/yarn-4.1.0.cjs build
```

Run the tests:

```sh
node .yarn/releases/yarn-4.1.0.cjs workspace dex-ui test
```

The suite mounts the real network guard, SDK provider, router, Jotai store,
and Wagmi configuration. It checks guest network selection, pool/deep links,
network navigation, invalid/unconfigured networks, connection transitions,
and disconnecting an actual Wagmi mock connector. RPC URLs are placeholders;
no live chain data, private keys, or wallet connection is required.

Live pool balances and an on-device mobile check remain deployment smoke tests.
