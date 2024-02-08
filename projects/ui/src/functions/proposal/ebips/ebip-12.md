Committed: November 8, 2023

## Submitter

Beanstalk Community Multisig

## Summary

Remove the `convert` function which was vulnerable.

## Links

Per the process outlined in the [BCM Emergency Response Procedures](https://docs.bean.money/almanac/governance/beanstalk/bcm-process#emergency-response-procedures), the BCM can take swift action to protect Beanstalk in the event of a bug or security vulnerability.

- [Safe Transaction](https://app.safe.global/transactions/tx?safe=eth:0xa9bA2C40b263843C04d344727b954A545c81D043&id=multisig_0xa9bA2C40b263843C04d344727b954A545c81D043_0xd4913d36e3c186653937c0a9346998be3b29e768e0696bb25e8516455c91702a)
- [Etherscan Transaction](https://etherscan.io/tx/0xf534d56d7ceb59d6c6b808a7b0f94959e4a27021925cad6fd263808ae76e1f84)
- [Arweave](https://arweave.net/zAtoxAMBSIVvJTPz45nXPT0lUbgU5Krw5MJ-SWwEmSI)

## Problem

Since Replant and prior to this EBIP, Converts did not validate that the pool being Converted in is whitelisted, which would have allowed an attacker to Convert all Beans in the the Beanstalk contract into their own Bean Deposits (which could then be Withdrawn and sold). 

## Solution

Remove the `convert` function until a fix can be implemented and sufficiently audited. 

## Contract Changes

### Convert Facet

The following `ConvertFacet` is removed from Beanstalk:
* [`0x08342a9e47D9A48F6a94823344FAFd24fB55266f`](https://etherscan.io/address/0x08342a9e47D9A48F6a94823344FAFd24fB55266f#code)

#### `ConvertFacet` Function Changes

| Name                         | Selector     | Action  | Type | New Functionality |
|:-----------------------------|:-------------|:--------|:-----|:------------------|
| `convert`                    | `0xb362a6e8` | Remove  | Call |                   |

### Event Changes

None.

## Beans Minted

None.

## Effective

Effective immediately upon commitment by the BCM, which has already happened.
