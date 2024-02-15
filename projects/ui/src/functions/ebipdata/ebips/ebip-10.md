Committed: October 23, 2023

## Submitter

Beanstalk Community Multisig

## Emergency Process Note

Per the process outlined in the [BCM Emergency Response Procedures](https://docs.bean.money/almanac/governance/beanstalk/bcm-process#emergency-response-procedures), the BCM can take swift action to protect Beanstalk in the event of a bug or security vulnerability.

## Links

- [GitHub PR](https://github.com/BeanstalkFarms/Beanstalk/pull/671)
- [Safe Transaction](https://app.safe.global/transactions/tx?safe=eth:0xa9bA2C40b263843C04d344727b954A545c81D043&id=multisig_0xa9bA2C40b263843C04d344727b954A545c81D043_0x5f7b910cd24efab72bdf5e3092f6481b4f8db1b53b43fdf26c8b489922ee321e)
- [Etherscan Transaction](https://etherscan.io/tx/0xe359e70e6f9a4b4ff55788855c5c1a2914e21102b914a71ac49b3cb2020f5989)
- [Arweave](https://arweave.net/im3PLE28EkO_eMo4fPmtcTYBJFRErxZ_44I_LWPDIB8)

## Problem

Since [BIP-38](https://bean.money/bip-38) was committed and prior to this EBIP, in Wells (i.e., only BEANETH currently), Farmers could Convert Deposited Beans to Deposited LP tokens past peg. Additionally, If a Farmer had enough Deposited Beans to Convert past peg, it was possible for that Farmer to Convert Deposited Beans to Deposited LP tokens up to the total amount of Beans in the Beanstalk contract. 

This was because Beanstalk was Converting (1) the amount the user input, rather than (2) the minimum of the amount the user input and the amount required to Convert to peg.

## Solution

Upgrade Beanstalk to only allow Converts up to (2).

All changes were reviewed by Cyfrin.

## Contract Changes

### Convert Facet

The following `ConvertFacet` is removed from Beanstalk:
* [`0xDc6B4ef6bA55706B19Bd389eA446d232eFb4E5D4`](https://etherscan.io/address/0xDc6B4ef6bA55706B19Bd389eA446d232eFb4E5D4#code)

The following `ConvertFacet` is added to Beanstalk:
* [`0x08342a9e47d9a48f6a94823344fafd24fb55266f`](https://etherscan.io/address/0x08342a9e47d9a48f6a94823344fafd24fb55266f#code)

#### `ConvertFacet` Function Changes

| Name                  | Selector     | Action   | Type | New Functionality |
|:----------------------|:-------------|:---------|:-----|:------------------|
| `convert`             | `0xb362a6e8` | Replace  | Call | ✓                 |

### Event Changes

None.

## Beans Minted

None.

## Effective

Effective immediately upon commitment by the BCM, which has already happened.
