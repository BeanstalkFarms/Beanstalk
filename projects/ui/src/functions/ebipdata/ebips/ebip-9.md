Committed: October 20, 2023

## Submitter

Beanstalk Community Multisig

## Emergency Process Note

Per the process outlined in the [BCM Emergency Response Procedures](https://docs.bean.money/almanac/governance/beanstalk/bcm-process#emergency-response-procedures), the BCM can take swift action to protect Beanstalk in the event of a bug or security vulnerability.

## Links

- [GitHub PR](https://github.com/BeanstalkFarms/Beanstalk/pull/669)
- [Safe Transaction](https://app.safe.global/transactions/tx?safe=eth:0xa9bA2C40b263843C04d344727b954A545c81D043&id=multisig_0xa9bA2C40b263843C04d344727b954A545c81D043_0x4a2ccbe02e1bc2179db2718262882ebbb8b3ba571b651991604611b00b70905a)
- [Etherscan Transaction](https://etherscan.io/tx/0x889a250e51296a632f8cddf5a519c75b55f3dedf9cb562efc603a67c18890c1d)
- [Arweave](https://arweave.net/uhIRmKbQM8N_ohjqs9wA_3RBn8AjhGbH_wOPaXu3be4)

## Problem

The first stage of the [BIP-38 migration process](https://bean.money/bip-38) is complete. The final stage of the process is to add the BEAN and ETH in the Beanstalk Community Multisig (BCM) as liquidity in the BEANETH Well. 

However, given (1) time-weighted average reserves in the Multi Flow Pump are used by Beanstalk for minting, (2) the 0.1% cap on changes in the TWA Multi Flow Pump reserves each block and (3) the extreme % increase in the Well reserves as a result of the addition of liquidity, it will take about a substantial amount of time after the addition of liquidity for the TWA Multi Flow Pump reserves to catch up to the current Well reserves. This is exaggerated if the ETH price moves up some % during the catch up period.

The reserves in the BEANETH Well are expected to increase by ~7700% as a result of adding the liquidity. Increasing at 0.1% a block, it would take 4345.98 blocks for the TWA Multi Flow Pump reserves to catch up to the current Well reserves. This is ~14.4866 hours. 

$$
1.001^x = \ln(77)
$$

$$
x \approx 4345.98 \\ \text{blocks}
$$

$$
\frac{x}{300} = \frac{4345.98}{300} \approx 14.4866 \\ \text{hours}
$$

## Solution

Turn off minting in the BEANETH Well until Season 16665 (about 20 Seasons after the transaction was committed, in order to substantially overestimate the calculation of ~14.4866 hours) by adding a check in `LibWellMinting.initializeOracle`.

All changes were reviewed by Cyfrin.

## Contract Changes

### Initialization Contract

The `init` function on the following `InitTurnOffBeanEthWell` contract is called:

- [`0xc42B40bb807bCCb5eae2d0279926E2c4aAbFE6cb`](https://etherscan.io/address/0xc42B40bb807bCCb5eae2d0279926E2c4aAbFE6cb#code)

### Season Facet

The following `SeasonFacet` is removed from Beanstalk:
* [`0x17b31771a04af17b131246c3c9d442e3c3908a27`](https://etherscan.io/address/0x17b31771a04af17b131246c3c9d442e3c3908a27#code)

The following `SeasonFacet` is added to Beanstalk:
* [`0x49435d19a5dcf8Ffe8a4EA5C310758784D3F4561`](https://etherscan.io/address/0x49435d19a5dcf8Ffe8a4EA5C310758784D3F4561#code)

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

None.

## Effective

Effective immediately upon commitment by the BCM, which has already happened.
