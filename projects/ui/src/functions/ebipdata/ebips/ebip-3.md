Committed: October 25, 2022

## Submitter

Beanstalk Community Multisig

## Emergency Process Note

Per the process outlined in the [BCM Emergency Response Procedures](https://docs.bean.money/governance/beanstalk/bcm-process#emergency-response-procedures), an emergency hotfix may be implemented by an emergency vote of the BCM if the bug is minor and does not require significant code changes.

This bug was reported by a whitehat on Immunefi.

## Links

- GitHub Commit Hash: [b2b7b6af2913dda868030fba4947575258583c69](https://github.com/BeanstalkFarms/Beanstalk/commit/b2b7b6af2913dda868030fba4947575258583c69)
- [GitHub PR](https://github.com/BeanstalkFarms/Beanstalk/pull/135)
- [Gnosis Transaction](https://gnosis-safe.io/app/eth:0xa9bA2C40b263843C04d344727b954A545c81D043/transactions/multisig_0xa9bA2C40b263843C04d344727b954A545c81D043_0xdac18161b1a78020e715360658d391ff442fed8ed43cd959516e4d05669f52e9)
- [Etherscan Transaction](https://etherscan.io/tx/0xaa7cef4a18a4ec997ad045bc68210606d0f69b4da6e9837107dcb43363f2f39a)
- [Arweave](https://arweave.net/OftwDeHeyC61Xe7nVjBpQITh7T3m08-hXF9sQ9TjMfs)

## Problem

Farmers could cancel Pod Listings on behalf of Farmers by calling the `fillPodListing(...)` function with an input `beanAmount = 0`.

This bug would not have resulted in any loss of funds.

## Solution

Add the following check: `require(amount > 0, "Marketplace: Must fill > 0 Pods.");`

The fix has been reviewed by Halborn.

## **Contract Changes**

The following callable functions are modified in Beanstalk:

| Name             | Selector     | Facet              |
|:-----------------|:-------------|:-------------------|
| `fillPodListing` | `0x1aac9789` | `MarketplaceFacet` |

## Effective

Effective immediately upon commit by the BCM, which has already happened.
