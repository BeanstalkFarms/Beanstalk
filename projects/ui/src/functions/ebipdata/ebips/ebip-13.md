Committed: November 9, 2023

## Submitter

Beanstalk Community Multisig

## Summary

Re-add the `convert` function with a new implementation that fixes the bug from [EBIP-12](https://arweave.net/AFsSqT2HE67IHqtxafvbluoZApdyofiHmvwGmzjTUPU).

## Links

Per the process outlined in the [BCM Emergency Response Procedures](https://docs.bean.money/almanac/governance/beanstalk/bcm-process#emergency-response-procedures), the BCM can take swift action to protect Beanstalk in the event of a bug or security vulnerability.

In the case of EBIP-13, functionality that was removed in EBIP-12 is reintroduced this EBIP.

- [EBIP-13 GitHub PR](https://github.com/BeanstalkFarms/Beanstalk/pull/682)
- GitHub Commit Hash: [77996e48e1979c493c94103c7b6f4876fa80e4dc](https://github.com/BeanstalkFarms/Beanstalk/tree/77996e48e1979c493c94103c7b6f4876fa80e4dc)
- [Safe Transaction](https://app.safe.global/transactions/tx?safe=eth:0xa9bA2C40b263843C04d344727b954A545c81D043&id=multisig_0xa9bA2C40b263843C04d344727b954A545c81D043_0xe8976073276b90cd7c5f1d5b7e4cef208fc3bdd2efee929d928d3d39a442eb9e)
- [Etherscan Transaction](https://etherscan.io/tx/0xc77cdf9771cd5b81866adf120f39f3cb3a15b6735882053a2ed0e2d3986d6b3d)
- [Arweave](https://arweave.net/zKpHhC4c8NhJecrEGHQ8F_vhrLVVEqdGKrQODSoIKbg)

## Problem

The `convert` function was removed in EBIP-12.

## Solution

Add `require` statements in `LibWellConvert` that verify that the Well being Converted in is whitelisted.

Add a `require` statement in `ConvertFacet` that verifies that the token amount being Converted from is greater than 0.

Re-add the `convert` function to Beanstalk.

All changes were reviewed by Cyfrin.

## Contract Changes

### Convert Facet

The following `ConvertFacet` is added to Beanstalk:
* [`0x7d19277B836D4787dC338251fbEd2e5841cF8c02`](https://etherscan.io/address/0x7d19277B836D4787dC338251fbEd2e5841cF8c02#code)

#### `ConvertFacet` Function Changes

| Name                         | Selector     | Action  | Type | New Functionality |
|:-----------------------------|:-------------|:--------|:-----|:------------------|
| `convert`                    | `0xb362a6e8` | Add     | Call | ✓                 |

### Event Changes

None.

## Beans Minted

None.

## Effective

Effective immediately upon commitment by the BCM, which has already happened.
