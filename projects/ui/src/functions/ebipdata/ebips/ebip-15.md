Committed: May 24, 2024

## Submitter

Beanstalk Community Multisig

## Summary

* Update Earned Bean Deposits such that they can be Withdrawn or Transferred when they have been Planted fewer than 2 `gm` calls ago; and
* Update the `balanceOfRoots` and `balanceOfEarnedBeans` functions to no longer revert unintentionally.

## Links

Per the process outlined in the [BCM Emergency Response Procedures](https://docs.bean.money/almanac/governance/beanstalk/bcm-process#emergency-response-procedures), the BCM can take swift action to protect Beanstalk in the event of a bug or security vulnerability.

- [EBIP-15 GitHub PR](https://github.com/BeanstalkFarms/Beanstalk/pull/892)
- GitHub Commit Hash: [2315d3f4a5dc217140c3b95cfec9f48a1d9c35f7](https://github.com/BeanstalkFarms/Beanstalk/tree/2315d3f4a5dc217140c3b95cfec9f48a1d9c35f7)
- [Safe Transaction](https://app.safe.global/transactions/tx?safe=eth:0xa9bA2C40b263843C04d344727b954A545c81D043&id=multisig_0xa9bA2C40b263843C04d344727b954A545c81D043_0x22522d7a8492e6ba31fb6379807158a4ac34f2ee49ba433c5fc8570a64d44123)
- [Etherscan Transaction](https://etherscan.io/tx/0x77f7b2a5b58891d4e42dc2381ac810381a426fc2bca8e07062323e8966f22b56)
- [Arweave](https://arweave.net/io-dM9ANb1g2HZlLdelkDdQF-iDc3HhdBJnkCFH1r34)

## Problem

Earned Bean Deposits cannot be Withdrawn or Transferred when they have been Planted fewer than 2 `gm` calls ago. This is a bug:
* Germinating Deposits (Deposits fewer than 2 `gm` calls old) are able to be Withdrawn or Transferred; and
* Earned Bean Deposits need not be subject to Germination given that holders already have Bean exposure.

The `balanceOfRoots` and `balanceOfEarnedBeans` functions unintentionally revert when the product of the user's Stalk and Roots exceeds the maximum `uint128` value.

## Solution

Update Germination logic to differentiate between Bean Deposits and Earned Bean Deposits with the same Stem. If the difference between the amount of Stalk to remove during a Withdraw or Transfer is greater than the Farmer's Germinating Stalk, that Stalk is associated with an Earned Bean Deposit.

Update `LibGerminate.calculateGerminatingRoots(...)`, called by `balanceOfRoots` and `balanceOfEarnedBeans`, to cast both `stalk` and `s.unclaimedGerminating[season].roots` to `uint256` before multiplying them in order to not overflow.

All changes were reviewed by Cyfrin.

## Contract Changes

### Silo Facet

The following `SiloFacet` is removed from Beanstalk:

- [`0x14047A7226c1e4a0dD15F69844e3771005cfa4e3`](https://etherscan.io/address/0x14047A7226c1e4a0dD15F69844e3771005cfa4e3#code)

The following `SiloFacet` is added to Beanstalk:

- [`0x2141950A9745DB6E5ad86931a257af8F5cCC00a3`](https://etherscan.io/address/0x2141950A9745DB6E5ad86931a257af8F5cCC00a3#code)

#### `SiloFacet` Function Changes

| Name                    | Selector     | Action  | Type | New Functionality |
|:------------------------|:-------------|:--------|:-----|:------------------|
| `claimPlenty`           | `0x45947ba9` | Replace | Call |                   |
| `deposit`               | `0xf19ed6be` | Replace | Call |                   |
| `mow`                   | `0x150d5173` | Replace | Call |                   |
| `mowMultiple`           | `0x7d44f5bb` | Replace | Call |                   |
| `plant`                 | `0x779b3c5c` | Replace | Call |                   |
| `safeBatchTransferFrom` | `0x2eb2c2d6` | Replace | Call | ✓                 |
| `safeTransferFrom`      | `0xf242432a` | Replace | Call | ✓                 |
| `transferDeposit`       | `0x081d77ba` | Replace | Call | ✓                 |
| `transferDeposits`      | `0xc56411f6` | Replace | Call | ✓                 |
| `withdrawDeposit`       | `0xe348f82b` | Replace | Call | ✓                 |
| `withdrawDeposits`      | `0x27e047f1` | Replace | Call | ✓                 |

### Silo Getters Facet

The following `SiloGettersFacet` is removed from Beanstalk:

- [`0xBbc36F691aBA133a214a8cb66Ab8847b8A3a5622`](https://etherscan.io/address/0xBbc36F691aBA133a214a8cb66Ab8847b8A3a5622#code)

The following `SiloGettersFacet` is added to Beanstalk:

- [`0xa548dAe98C0C974FA4B4106618a71CAae5e5ea4d`](https://etherscan.io/address/0xa548dAe98C0C974FA4B4106618a71CAae5e5ea4d#code)

#### `SiloGettersFacet` Function Changes

| Name                                         | Selector     | Action  | Type | New Functionality |
|:---------------------------------------------|:-------------|:--------|:-----|:------------------|
| `balanceOf`                                  | `0x00fdd58e` | Replace | View |                   |
| `balanceOfBatch`                             | `0x4e1273f4` | Replace | View |                   |
| `balanceOfDepositedBDV`                      | `0xbc8514cf` | Replace | View |                   |
| `balanceOfEarnedBeans`                       | `0x3e465a2e` | Replace | View | ✓                 |
| `balanceOfEarnedStalk`                       | `0x341b94d5` | Replace | View |                   |
| `balanceOfFinishedGerminatingStalkAndRoots`  | `0xc063989e` | Replace | View |                   |
| `balanceOfGerminatingStalk`                  | `0x838082b5` | Replace | View |                   |
| `balanceOfGrownStalk`                        | `0x8915ba24` | Replace | View |                   |
| `balanceOfPlenty`                            | `0x896651e8` | Replace | View |                   |
| `balanceOfRainRoots`                         | `0x69fbad94` | Replace | View |                   |
| `balanceOfRoots`                             | `0xba39dc02` | Replace | View | ✓                 |
| `balanceOfSop`                               | `0xa7bf680f` | Replace | View |                   |
| `balanceOfStalk`                             | `0x8eeae310` | Replace | View |                   |
| `balanceOfYoungAndMatureGerminatingStalk`    | `0x0fb01e05` | Replace | View |                   |
| `bdv`                                        | `0x8c1e6f22` | Replace | View |                   |
| `getDeposit`                                 | `0x61449212` | Replace | View |                   |
| `getDepositId`                               | `0x98f2b8ad` | Replace | View |                   |
| `getEvenGerminating`                         | `0x1ca5f625` | Replace | View |                   |
| `getGerminatingRootsForSeason`               | `0x96e7f21e` | Replace | View |                   |
| `getGerminatingStalkAndRootsForSeason`       | `0x4118140a` | Replace | View |                   |
| `getGerminatingStalkForSeason`               | `0x9256dccd` | Replace | View |                   |
| `getGerminatingStem`                         | `0xa953f06d` | Replace | View |                   |
| `getGerminatingStems`                        | `0xe5b17f2a` | Replace | View |                   |
| `getGerminatingTotalDeposited`               | `0xc25a156c` | Replace | View |                   |
| `getGerminatingTotalDepositedBdv`            | `0x9b3ec513` | Replace | View |                   |
| `getLastMowedStem`                           | `0x7fc06e12` | Replace | View |                   |
| `getLegacySeedsPerToken`                     | `0xf5cb9097` | Replace | View |                   |
| `getMowStatus`                               | `0xdc25a650` | Replace | View |                   |
| `getOddGerminating`                          | `0x85167e51` | Replace | View |                   |
| `getTotalDeposited`                          | `0x0c9c31bd` | Replace | View |                   |
| `getTotalDepositedBDV`                       | `0x9d6a924e` | Replace | View |                   |
| `getTotalGerminatingAmount`                  | `0xb45ef2eb` | Replace | View |                   |
| `getTotalGerminatingBdv`                     | `0x9dcf67f0` | Replace | View |                   |
| `getTotalGerminatingStalk`                   | `0x7d4a51cb` | Replace | View |                   |
| `getYoungAndMatureGerminatingTotalStalk`     | `0x5a8e63e3` | Replace | View |                   |
| `grownStalkForDeposit`                       | `0x3a1b0606` | Replace | View |                   |
| `lastSeasonOfPlenty`                         | `0xbe6547d2` | Replace | View |                   |
| `lastUpdate`                                 | `0xcb03fb1e` | Replace | View |                   |
| `migrationNeeded`                            | `0xc38b3c18` | Replace | View |                   |
| `seasonToStem`                               | `0x896ab1c6` | Replace | View |                   |
| `stemStartSeason`                            | `0xbc771977` | Replace | View |                   |
| `stemTipForToken`                            | `0xabed2d41` | Replace | View |                   |
| `tokenSettings`                              | `0xe923e8d4` | Replace | View |                   |
| `totalEarnedBeans`                           | `0xfd9de166` | Replace | View |                   |
| `totalRoots`                                 | `0x46544166` | Replace | View |                   |
| `totalStalk`                                 | `0x7b52fadf` | Replace | View |                   |

### Event Changes

None.

## Beans Minted

None.

## Effective

Effective immediately upon commitment by the BCM, which has already happened.
