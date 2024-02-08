Committed: October 30, 2023

## Submitter

Beanstalk Community Multisig

## Summary

* Add support for querying a time weighted average (TWA) ETH/USD price from Chainlink;
* Change the Chainlink component of the ETH/USD minting oracle from an instantaneous price to a 60 minute TWA price;
* Change the Uniswap V3 component of the ETH/USD minting oracle from 15 minute TWA prices to 60 minute TWA prices; and
* Mint 4194.934459 Beans to recapitalize the Beanstalk contract as a result of the issue fixed in [EBIP-10](https://arweave.net/im3PLE28EkO_eMo4fPmtcTYBJFRErxZ_44I_LWPDIB8).

## Links

Per the process outlined in the [BCM Emergency Response Procedures](https://docs.bean.money/almanac/governance/beanstalk/bcm-process#emergency-response-procedures), the BCM can take swift action to protect Beanstalk in the event of a bug or security vulnerability.

- [EBIP-11 GitHub PR](https://github.com/BeanstalkFarms/Beanstalk/pull/676)
- GitHub Commit Hash: [82f980b8e94f97873fb3d1fc6e99930a01ad2c16](https://github.com/BeanstalkFarms/Beanstalk/tree/82f980b8e94f97873fb3d1fc6e99930a01ad2c16)
- [Safe Transaction](https://app.safe.global/transactions/tx?safe=eth:0xa9bA2C40b263843C04d344727b954A545c81D043&id=multisig_0xa9bA2C40b263843C04d344727b954A545c81D043_0x8d27eee634375e119bd932998c55364a038ac7fe15816e4bfd20bd8d55702da9)
- [Etherscan Transaction](https://etherscan.io/tx/0x6157f2797bc7b5c4bc93213fce33c5f96c34451a07de239997655681d5069098)
- [Arweave](https://arweave.net/bTctEp7SvK7wVuQbSkkPO2LJce5fWEEM9QiIiKszg2w)

## Problem

### TWA Chainlink Price

Prior to this EBIP, Beanstalk did not support querying a TWA price from the ETH/USD Chainlink data feed.

### Change ETH/USD Minting Oracle

Since [BIP-37](https://arweave.net/VPF1EafHb41Y7AjzUYB0j-mR8Sl0KxPknDJYffczBpc) was committed, and prior to this EBIP, when determining how many Beans/Soil to mint, Beanstalk calculated the price of ETH in USD using the instantaneous price from the Chainlink ETH/USD data feed and compared it 15 minute TWA prices in the ETH:USDC and ETH:USDT 0.05% fee Uniswap V3 pools. 

When minting Beans during a `gm` call, Beanstalk compared this USD price of ETH with the TWA reserves of Beans and ETH in Multi Flow to calculate the TWA deltaB in the BEANETH Well. Because the Chainlink price in the former was not time weighted, the TWA deltaB calculated at the end of the Season would be higher than necessary if the ETH price was increasing. Similarly, the TWA deltaB calculated at the end of the Season would be lower than necessary if the ETH price was decreasing.

### Removed Beans from EBIP-10 Issue

As a result of the issue fixed in EBIP-10, about 33,049.986249 excess Beans were removed from the Beanstalk contract. About 28,855.05179 of these Beans were returned by the Farmers who Converted extra Beans as a result of the issue, resulting in a difference of 4,194.934459 Beans that are still missing from Beanstalk.

## Solution

All changes were reviewed by Cyfrin.

### TWA Chainlink Price

Add support for querying a time weighted average (TWA) ETH/USD price from Chainlink.

### Change ETH/USD Minting Oracle

Upgrade the ETH/USD price that the Well minting oracle uses to:
* 60 minute TWA price from the ETH/USD Chainlink data feed; and
* 60 minute TWA prices from the ETH:USDC and ETH:USDT 0.05% fee Uniswap V3 pools. 

### Removed Beans from EBIP-10 Issue

Mint the remaining 4,194.934459 Beans to the Beanstalk contract.

## Contract Changes

### Initialization Contract

The `init` function on the following `InitMint` contract is called:

- [`0x077495925c17230E5e8951443d547ECdbB4925Bb`](https://etherscan.io/address/0x077495925c17230E5e8951443d547ECdbB4925Bb#code)

### Season Facet

The following `SeasonFacet` is removed from Beanstalk:
* [`0x49435d19a5dcf8ffe8a4ea5c310758784d3f4561`](https://etherscan.io/address/0x49435d19a5dcf8ffe8a4ea5c310758784d3f4561#code)

The following `SeasonFacet` is added to Beanstalk:
* [`0x5eAfF0d247ee998bb4827B24292EAdC7f14f3EfC`](https://etherscan.io/address/0x5eAfF0d247ee998bb4827B24292EAdC7f14f3EfC#code)

#### `SeasonFacet` Function Changes

| Name                         | Selector     | Action  | Type | New Functionality |
|:-----------------------------|:-------------|:--------|:-----|:------------------|
| `abovePeg`                   | `0x2a27c499` | Replace | View |                   |
| `curveOracle`                | `0x07a3b202` | Replace | View |                   |
| `paused`                     | `0x5c975abb` | Replace | View |                   |
| `plentyPerRoot`              | `0xe60d7a83` | Replace | View |                   |
| `poolDeltaB`                 | `0x471bcdbe` | Replace | View |                   |
| `rain`                       | `0x43def26e` | Replace | View |                   |
| `season`                     | `0xc50b0fb0` | Replace | View |                   |
| `seasonTime`                 | `0xca7b7d7b` | Replace | View |                   |
| `sunriseBlock`               | `0x3b2ecb70` | Replace | View |                   |
| `time`                       | `0x16ada547` | Replace | View |                   |
| `totalDeltaB`                | `0x06c499d8` | Replace | View |                   |
| `weather`                    | `0x686b6159` | Replace | View |                   |
| `wellOracleSnapshot`         | `0x597490c0` | Replace | View |                   |
| `gm`                         | `0x64ee4b80` | Replace | Call | ✓                 |
| `sunrise`                    | `0xfc06d2a6` | Replace | Call |                   |

### Event Changes

None.

## Beans Minted

A total of 4,194.934459 Beans are minted to the Beanstalk contract ([0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5](https://etherscan.io/address/0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5)) to cover the remaining Beans removed from Beanstalk as a result of the issue fixed in EBIP-10.

## Effective

Effective immediately upon commitment by the BCM, which has already happened.
