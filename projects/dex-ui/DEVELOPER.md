## Developer Notes

This doc should provide an overview of how the DEX works and some of the nuances that devs should be aware of

### React Query
We're making heavy use of [React Query](https://tanstack.com/query/v4/docs/react/overview). It's imperative that you understand how it works and how the query keys affect when things get executed. Query keys are like dependency arrays, and we rely on this feature to triger query executions and caching.




