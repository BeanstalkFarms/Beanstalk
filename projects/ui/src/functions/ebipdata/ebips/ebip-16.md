Committed: June 2, 2024

## Submitter

Beanstalk Community Multisig

## Summary

* Update Withdrawal logic to correctly decrement a Farmer's Stalk and the total Deposited BDV and amount when Withdrawing a Germinating Earned Bean Deposit; and
* Redeploy the Convert and Enroot facets with the new `LibGerminate` functionality from [EBIP-15](https://arweave.net/BUAXNrjoPoL3FoICcFe4Axvl3d99-LmPncAZvNFYv_M).

## Links

Per the process outlined in the [BCM Emergency Response Procedures](https://docs.bean.money/almanac/governance/beanstalk/bcm-process#emergency-response-procedures), the BCM can take swift action to protect Beanstalk in the event of a bug or security vulnerability.

- [EBIP-16 GitHub PR](https://github.com/BeanstalkFarms/Beanstalk/pull/914)
- GitHub Commit Hash: [52152aba368a99bedaface6f18ec432ee3bb9a0a](https://github.com/BeanstalkFarms/Beanstalk/tree/52152aba368a99bedaface6f18ec432ee3bb9a0a)
- [Safe Transaction](https://app.safe.global/transactions/tx?safe=eth:0xa9bA2C40b263843C04d344727b954A545c81D043&id=multisig_0xa9bA2C40b263843C04d344727b954A545c81D043_0x07509a5c2a87479769b210aa12e46ac95915893406b54a4a4871fc1a24fc6cad)
- [Etherscan Transaction](https://etherscan.io/tx/0xafb329f583b24e455e64be9d643b61551b31f6e18de202eed7a5fe5466725e50)
- [Arweave](https://arweave.net/pr5H4W_ELFdWBaFw_wHW9AIb8zaDK45ibueH7AQyswE)

## Problem

Since EBIP-15, when Earned Bean Deposits were Withdrawn or Transferred <2 `gm` calls after being Planted, the user's Stalk and the system's total Deposited BDV were not properly decremented. This allowed users to retain the Stalk associated with Earned Bean Deposits post-Withdrawal.

The Convert and Enroot facets were not redeployed as part of EBIP-15, meaning that the `balanceOfRoots` functions in those facets would continue to unintentionally revert when the product of the user's Stalk and Roots exceeded `uint128`.

## Solution

In `TokenSilo._withdrawGerminating`, burn the Stalk associated with the Earned Bean Deposit and decrement the total Deposited BDV accordingly.

In `LibSilo.transferStalkAndGerminatingStalk`, update `checkForEarnedBeans` to return both the Germinating and Earned Beans portion of Stalk. This is done in order to fix the issue in `TokenSilo._withdrawGerminating`.

Redeploy the Convert and Enroot facets with the updated `balanceOfRoots` functions.

All changes were reviewed by Cyfrin prior to deployment.

## Contract Changes

### Silo Facet

The following `SiloFacet` is removed from Beanstalk:

- [`0x2141950A9745DB6E5ad86931a257af8F5cCC00a3`](https://etherscan.io/address/0x2141950A9745DB6E5ad86931a257af8F5cCC00a3#code)

The following `SiloFacet` is added to Beanstalk:

- [`0x5e81bD0d37632B82899D53Ca212E134f75A1FbA7`](https://etherscan.io/address/0x5e81bD0d37632B82899D53Ca212E134f75A1FbA7#code)

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

- [`0xa548dAe98C0C974FA4B4106618a71CAae5e5ea4d`](https://etherscan.io/address/0xa548dAe98C0C974FA4B4106618a71CAae5e5ea4d#code)

The following `SiloGettersFacet` is added to Beanstalk:

- [`0x988305e6727A79230eb22E1C73606780269bf9A8`](https://etherscan.io/address/0x988305e6727A79230eb22E1C73606780269bf9A8#code)

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

### Convert Facet

The following `ConvertFacet` is removed from Beanstalk:

- [`0x8257C2EB3265640714cCF298ad208E3054EF675F`](https://etherscan.io/address/0x8257C2EB3265640714cCF298ad208E3054EF675F#code)

The following `ConvertFacet` is added to Beanstalk:

- [`0xedac366Acf56abbDe00B5149481B05cA7041f385`](https://etherscan.io/address/0xedac366Acf56abbDe00B5149481B05cA7041f385#code)

#### `ConvertFacet` Function Changes

| Name                    | Selector     | Action  | Type | New Functionality |
|:------------------------|:-------------|:--------|:-----|:------------------|
| `convert`               | `0xb362a6e8` | Replace | Call | ✓                 |

### Enroot Facet

The following `EnrootFacet` is removed from Beanstalk:

- [`0x305d7c1C53817a4e5b66043e9883FB14b2005B6B`](https://etherscan.io/address/0x305d7c1C53817a4e5b66043e9883FB14b2005B6B#code)

The following `EnrootFacet` is added to Beanstalk:

- [`0x96FdD89272764100dE6dF791985Fd268204485C1`](https://etherscan.io/address/0x96FdD89272764100dE6dF791985Fd268204485C1#code)

#### `EnrootFacet` Function Changes

| Name                    | Selector     | Action  | Type | New Functionality |
|:------------------------|:-------------|:--------|:-----|:------------------|
| `enrootDeposit`         | `0x0b58f073` | Replace | Call | ✓                 |
| `enrootDeposits`        | `0x88fcd169` | Replace | Call | ✓                 |

### Event Changes

None.

## Beans Minted

None.

## Effective

Effective immediately upon commitment by the BCM, which has already happened.
