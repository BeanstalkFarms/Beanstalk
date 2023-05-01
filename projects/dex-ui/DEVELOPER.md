## Developer Notes

This doc should provide an overview of how the DEX works and some of the nuances that devs should be aware of

### React Query

We're making heavy use of [React Query](https://tanstack.com/query/v4/docs/react/overview). It's imperative that you understand how it works and how the query keys affect when things get executed. Query keys are like dependency arrays, and we rely on this feature to triger query executions and caching.

### WAGMI and SDK states

Wagmi doesn't immediately read the status from metamask, which means the site first loads with wagmi in an unconnected, no user, no network, nothing known state. Then, it enters a known state of either connected or not. If WAGMI is not connected, we use a default provider so the site is still functional in a read-only mode; you can run quotes and list wells, etc... Once a wallet is connected, WAGMI updates again with the user data. So WAGMI goes from LOADIN > UNCONNECTED > CONNECTED (or directly to CONNECTED if use has previously connected).

The Beanstalk SDK needs a provider or a signer to be initialized, so because of WAGMI, it too gets initialized first with a default provider, aka readonly, then with a signer once wagmi is connected.

It's important to keep this in mind, because there are SDK components that can work with EITHER a provider or a signer, in a readonly or read and write mode. For example:

- Tokens: can create and use a Token object with just a Provider, but attempted to do a write operation, such as setting approvals, will result in an "operation requires signer" error
- Wells: similarly, wells can be readonly with just a Provider, or we can act on them (do swaps, add/remove liquidity, etc..) if we configure a signer.

** Furthermore ** - it's important to keep in mind that if a user changes their connected account, for ex in Metamask, this _should_ instantiate a new SDK, and all previously "connected" data, such as Wells and Tokens, need to be "re-connected".

Next sections will touch more on how this is handled

## Loading Data

When site loads, the `<TokenProvider />` in `Wrapper.tsx` will attempt to load all the tokens that this DEX supports. To get the list of Tokens, we need a list of Well addresses, then for each address, we instantiate a `Well` SDK object (`new Well(address)`) which we use to get the well's tokens with `well.getTokens()`.

Wells are loaded from the `useWells.tsx` hook. In this file, we use React Query `useQuery()` with a cache key of `["wells", !!sdk.signer]`. This means that if the signer changes, we refetch. Why? Because the wells were initialized with just a Provider due to WAGMI/SDK (see above), but now we might have a signer (or not, if user disconnected). So we need to rebuild the Well objects.

We use an infinite `staleTime` for this query; the cache is valid "infinitely" (until reload), and further visits to the Wells page, or requests for wells will NOT trigger a network request, they will be served from the cache. Since Wells are likely to not change frequently, it's ok to cache for the duration of a user's visit. In the future, we want to explore saving this cache to localStorage and optimistically loading the data from there, _while still_ fetching a network request in the background.

### Well fetching

Loading a list of wells involves to main steps (this all starts in useWells.tsx):

- get a list of addresses of the deployed wells
- build sdk `Well` objects from the addresses, `new Well(address)`

To get the list of addresses, we race two sources with Promise.any(); the subgraph and direct events from the chain. Why? For local development; it's nice to not have to spin up the subgraphs, plus it give us a backup if subgraph is ever not available. We should do this for all subgraph queries.




