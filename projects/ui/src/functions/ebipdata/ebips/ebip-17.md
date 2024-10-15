Committed: July 16, 2024

## Submitter

Beanstalk Community Multisig

## Summary

* Update the create and fill Pod Order functions such that future Pod Orders cannot be created with and existing Pod Orders cannot be executed with a zero `minFillAmount`;
* Change the amount of Stalk that is burned during a migration to Silo V3 from being based on the difference between (1) the Season that [EBIP-8](https://arweave.net/bnLvAXT1eM2vVh76iPXU-k71PPJ4KxGIz-StF5KqY-c) was committed and the current Season to (2) the Season that EBIP-8 was committed and the Season that Silo V3 ([BIP-36](https://arweave.net/iAw0azcY80S7Gu0T74cjgZcqVD7Ho3gGr9eiPXtuPqQ)) was committed;
* Adjust the Stalk balances for accounts affected by the accounting error introduced in [EBIP-15](https://arweave.net/io-dM9ANb1g2HZlLdelkDdQF-iDc3HhdBJnkCFH1r34) and fixed in [EBIP-16](https://arweave.net/pr5H4W_ELFdWBaFw_wHW9AIb8zaDK45ibueH7AQyswE);
* Implement Flood fixes:
    * When Mowing, perform the Germination process for the Farmer prior to performing logic related to Flood and allocate Plenty to Farmers who earned Plenty during the last Flood;
    * During `gm`, perform the Germination process for the Silo prior to performing logic related to Flood; and
    * Stop distributing Plenty to Deposits that are Withdrawn during a Flood that lasts multiple Seasons.

## Links

Per the process outlined in the [BCM Emergency Response Procedures](https://docs.bean.money/almanac/governance/beanstalk/bcm-process#emergency-response-procedures), the BCM can take swift action to protect Beanstalk in the event of a bug or security vulnerability.

- [EBIP-17 GitHub PR](https://github.com/BeanstalkFarms/Beanstalk/pull/960)
- GitHub Commit Hash: [36b8574bdb96c1045a4d361ee0b2fe7e23e4cbcf](https://github.com/BeanstalkFarms/Beanstalk/tree/36b8574bdb96c1045a4d361ee0b2fe7e23e4cbcf)
- [Safe Transaction](https://app.safe.global/transactions/tx?safe=eth:0xa9bA2C40b263843C04d344727b954A545c81D043&id=multisig_0xa9bA2C40b263843C04d344727b954A545c81D043_0xc4bfc57d6ccde536cc9247aa78299ebb151620e64b17ada7bc185ad07b7296cf)
- [Etherscan Transaction](https://etherscan.io/tx/0x60e2a439900f3a41911baea15c7ec61aa8f2b9aa97d26f6455068090772959b9)
- [Arweave](https://arweave.net/LU8hcRxECJRKih7RXvlPYKcVPTMzbCMk7AzyzRPJBps)

## Problem

If a Farmer created a Pod Order with a `minFillAmount` of 0 and a `maxPlaceInLine` such that they have some Pods that are before this place in line (e.g., a Farmer creates an Order with a `maxPlaceInLine` of 50 million, and has a Plot at place 40 million in line), an attacker can fill this Pod Order (with a `minFillAmount` of 0) and delete the Farmer's Plot (by setting `index` to the index that the Farmer has). 

Prior to Silo V3, a bug that was fixed by EBIP-8 caused excess Stalk and Seeds to be given to some accounts that Enrooted. This difference was intended to be accounted for (i.e., burned) upon migration to Silo V3, but an error in the calculation of this discrepancy resulted in about ~20 accounts being unable to migrate. 

EBIP-15 introduced a bug that didn't decrement enough Stalk when Germinating Earned Bean Deposits were Withdrawn, which was fixed in EBIP-16. Another upgrade is required to remove the excess Stalk from affected accounts.

Currently: 
* When Plenty is distributed to Roots (an internal accounting variable that tracks Stalk ownership) based on the Roots at the time of the Flood, Roots associated with Deposits that have completed Germination but have not been Mown yet are not included;
* If a Farmer earns Plenty from a Flood, Withdraws all of their assets, and then Mows during the next Oversaturation Season (referred to as `raining` in the contracts), they lose the Plenty associated with that Flood;
* If there are Germinating Stalk when it starts `raining`, Beanstalk does not properly credit those Deposits with Plenty; and
* If a Farmer Withdraws their assets during a Flood that lasts multiple Seasons, they continue to earn Plenty during that Flood based on those assets.

## Solution

Add a `minFillAmount > 0` check to `_createPodOrder` and `_createPodOrderV2`, such that future Pod Orders cannot be created with a zero `minFillAmount`. Add an `amount > 0` check to `_fillPodOrder` and `_fillPodOrderV2` to prevent existing Pod Orders from being executed with a zero `amount`. 

In `LibLegacyTokenSilo._mowAndMigrate()`, change the amount of Stalk that is burned from being based on the difference between (1) the Season that EBIP-8 was committed and the current Season to (2) the Season that EBIP-8 was committed and the Season that Silo V3 was committed.

Remove the excess Stalk from accounts that were affected by the Germinating Earned Bean Deposit bug introduced in EBIP-15 and fixed in EBIP-16.

In `LibSilo._mow()`, perform the Germination process for the Farmer prior to performing logic related to Flood.

Update `LibSilo._mow()` to allocate Plenty from the last Flood to the Farmer if applicable when `lastRain > 0`.

In `SeasonFacet.gm()`, perform the Germination process for the Silo prior to performing logic related to Flood.

Update `LibSilo.burnActiveStalk()` and `LibSilo.transferStalk()` to reduce the Farmer's `sopRoots` associated with the burned Stalk upon Withdrawal and Transfer, respectively.

All changes were reviewed by a top Codehawks auditor.

## Contract Changes

### Initialization Contract

The `init` function on the following `InitHotFix6` contract is called:

- [`0x451E36ca0A21F0d946b1f4710EA41BB557CBD8a6`](https://etherscan.io/address/0x451E36ca0A21F0d946b1f4710EA41BB557CBD8a6#code)

### Marketplace Facet

The following `MarketplaceFacet` is removed from Beanstalk:

- [`0x0c9F436FBEf08914c1C68fe04bD573de6e327776`](https://etherscan.io/address/0x0c9F436FBEf08914c1C68fe04bD573de6e327776#code)

The following `MarketplaceFacet` is added to Beanstalk:

- [`0xB932fE3760889ad287fb39A2bebB03BB4a0DD5ff`](https://etherscan.io/address/0xB932fE3760889ad287fb39A2bebB03BB4a0DD5ff#code)

#### `MarketplaceFacet` Function Changes

| Name                               | Selector     | Action  | Type  | New Functionality |
|:-----------------------------------|:-------------|:--------|:------|:------------------|
| `allowancePods`                    | `0x0b385a85` | Replace | Read  |                   |
| `approvePods  `                    | `0xc5644a60` | Replace | Write |                   |
| `cancelPodListing`                 | `0x3260c49e` | Replace | Write |                   |
| `cancelPodOrder`                   | `0xdf18a3ee` | Replace | Write |                   |
| `cancelPodOrderV2`                 | `0xf22b49ec` | Replace | Write |                   |
| `createPodListing`                 | `0x80bd7d33` | Replace | Write |                   |
| `createPodListingV2`               | `0xa8f135a2` | Replace | Write |                   |
| `createPodOrder`                   | `0x82c65124` | Replace | Write |  ✓                |
| `createPodOrderV2`                 | `0x83601992` | Replace | Write |  ✓                |
| `fillPodListing`                   | `0xeda8156e` | Replace | Write |                   |
| `fillPodListingV2`                 | `0xa99d840c` | Replace | Write |                   |
| `fillPodOrder`                     | `0x845a022b` | Replace | Write |  ✓                |
| `fillPodOrderV2`                   | `0x4214861e` | Replace | Write |  ✓                |
| `getAmountBeansToFillOrderV2`      | `0x7e2a1fd1` | Replace | Read  |                   |
| `getAmountPodsFromFillListingV2`   | `0xc3e14715` | Replace | Read  |                   |
| `podListing`                       | `0xd6af17ab` | Replace | Read  |                   |
| `podOrder`                         | `0x042ff31d` | Replace | Read  |                   |
| `podOrderById`                     | `0xb1719e59` | Replace | Read  |                   |
| `podOrderV2`                       | `0x045d5763` | Replace | Read  |                   |
| `transferPlot`                     | `0x69d9120d` | Replace | Write |  ✓                |

### Migration Facet 

The following `MigrationFacet` is removed from Beanstalk:

- [`0x5A3C138cDb894e6d200CCd350cdeE7404b1f3c9B`](https://etherscan.io/address/0x5A3C138cDb894e6d200CCd350cdeE7404b1f3c9B#code)

The following `MigrationFacet` is added to Beanstalk:

- [`0x6122B95290F35E4665dE44A80A9C16fe50916B16`](https://etherscan.io/address/0x6122B95290F35E4665dE44A80A9C16fe50916B16#code)

#### `MigrationFacet` Function Changes

| Name                                     | Selector     | Action  | Type  | New Functionality |
|:-----------------------------------------|:-------------|:--------|:------|:------------------|
| `balanceOfGrownStalkUpToStemsDeployment` | `0x505f43ea` | Replace | Read  |                   |
| `balanceOfLegacySeeds`                   | `0x1be2cfd8` | Replace | Read  |                   |
| `getDepositLegacy`                       | `0xa9be1acb` | Replace | Read  |                   |
| `mowAndMigrate`                          | `0x1f4f3d55` | Replace | Write | ✓                 |
| `mowAndMigrateNoDeposits`                | `0xaed942e9` | Replace | Write |                   |
| `totalMigratedBdv`                       | `0x2b8cde0d` | Replace | Read  |                   |

### Silo Facet

The following `SiloFacet` is removed from Beanstalk:

- [`0x5e81bD0d37632B82899D53Ca212E134f75A1FbA7`](https://etherscan.io/address/0x5e81bD0d37632B82899D53Ca212E134f75A1FbA7#code)

The following `SiloFacet` is added to Beanstalk:

- [`0x97Fc5eEF1a02A2c5bcB3a04997ebA7E0d3074f15`](https://etherscan.io/address/0x97Fc5eEF1a02A2c5bcB3a04997ebA7E0d3074f15#code)

#### `SiloFacet` Function Changes

| Name                    | Selector     | Action  | Type  | New Functionality |
|:------------------------|:-------------|:--------|:------|:------------------|
| `claimPlenty`           | `0x45947ba9` | Replace | Write | ✓                 |
| `deposit`               | `0xf19ed6be` | Replace | Write | ✓                 |
| `mow`                   | `0x150d5173` | Replace | Write | ✓                 |
| `mowMultiple`           | `0x7d44f5bb` | Replace | Write | ✓                 |
| `plant`                 | `0x779b3c5c` | Replace | Write |                   |
| `safeBatchTransferFrom` | `0x2eb2c2d6` | Replace | Write |                   |
| `safeTransferFrom`      | `0xf242432a` | Replace | Write |                   |
| `transferDeposit`       | `0x081d77ba` | Replace | Write | ✓                 |
| `transferDeposits`      | `0xc56411f6` | Replace | Write | ✓                 |
| `withdrawDeposit`       | `0xe348f82b` | Replace | Write | ✓                 |
| `withdrawDeposits`      | `0x27e047f1` | Replace | Write | ✓                 |

### Silo Getters Facet

The following `SiloGettersFacet` is removed to Beanstalk:

- [`0x988305e6727A79230eb22E1C73606780269bf9A8`](https://etherscan.io/address/0x988305e6727A79230eb22E1C73606780269bf9A8#code)

The following `SiloGettersFacet` is added to Beanstalk:

- [`0x3F3D1d3269C2bdc789DbddD5A6a20e56fF267288`](https://etherscan.io/address/0x3F3D1d3269C2bdc789DbddD5A6a20e56fF267288#code)

#### `SiloGettersFacet` Function Changes

| Name                                         | Selector     | Action  | Type | New Functionality |
|:---------------------------------------------|:-------------|:--------|:-----|:------------------|
| `totalRainRoots`                             | `0xaea72f96` | Add     | Read | ✓                 |
| `balanceOf`                                  | `0x00fdd58e` | Replace | Read |                   |
| `balanceOfBatch`                             | `0x4e1273f4` | Replace | Read |                   |
| `balanceOfDepositedBDV`                      | `0xbc8514cf` | Replace | Read |                   |
| `balanceOfEarnedBeans`                       | `0x3e465a2e` | Replace | Read |                   |
| `balanceOfEarnedStalk`                       | `0x341b94d5` | Replace | Read |                   |
| `balanceOfFinishedGerminatingStalkAndRoots`  | `0xc063989e` | Replace | Read |                   |
| `balanceOfGerminatingStalk`                  | `0x838082b5` | Replace | Read |                   |
| `balanceOfGrownStalk`                        | `0x8915ba24` | Replace | Read |                   |
| `balanceOfPlenty`                            | `0x896651e8` | Replace | Read |                   |
| `balanceOfRainRoots`                         | `0x69fbad94` | Replace | Read |                   |
| `balanceOfRoots`                             | `0xba39dc02` | Replace | Read |                   |
| `balanceOfSop`                               | `0xa7bf680f` | Replace | Read |                   |
| `balanceOfStalk`                             | `0x8eeae310` | Replace | Read |                   |
| `balanceOfYoungAndMatureGerminatingStalk`    | `0x0fb01e05` | Replace | Read |                   |
| `bdv`                                        | `0x8c1e6f22` | Replace | Read |                   |
| `getDeposit`                                 | `0x61449212` | Replace | Read |                   |
| `getDepositId`                               | `0x98f2b8ad` | Replace | Read |                   |
| `getEvenGerminating`                         | `0x1ca5f625` | Replace | Read |                   |
| `getGerminatingRootsForSeason`               | `0x96e7f21e` | Replace | Read |                   |
| `getGerminatingStalkAndRootsForSeason`       | `0x4118140a` | Replace | Read |                   |
| `getGerminatingStalkForSeason`               | `0x9256dccd` | Replace | Read |                   |
| `getGerminatingStem`                         | `0xa953f06d` | Replace | Read |                   |
| `getGerminatingStems`                        | `0xe5b17f2a` | Replace | Read |                   |
| `getGerminatingTotalDeposited`               | `0xc25a156c` | Replace | Read |                   |
| `getGerminatingTotalDepositedBdv`            | `0x9b3ec513` | Replace | Read |                   |
| `getLastMowedStem`                           | `0x7fc06e12` | Replace | Read |                   |
| `getLegacySeedsPerToken`                     | `0xf5cb9097` | Replace | Read |                   |
| `getMowStatus`                               | `0xdc25a650` | Replace | Read |                   |
| `getOddGerminating`                          | `0x85167e51` | Replace | Read |                   |
| `getTotalDeposited`                          | `0x0c9c31bd` | Replace | Read |                   |
| `getTotalDepositedBDV`                       | `0x9d6a924e` | Replace | Read |                   |
| `getTotalGerminatingAmount`                  | `0xb45ef2eb` | Replace | Read |                   |
| `getTotalGerminatingBdv`                     | `0x9dcf67f0` | Replace | Read |                   |
| `getTotalGerminatingStalk`                   | `0x7d4a51cb` | Replace | Read |                   |
| `getYoungAndMatureGerminatingTotalStalk`     | `0x5a8e63e3` | Replace | Read |                   |
| `grownStalkForDeposit`                       | `0x3a1b0606` | Replace | Read |                   |
| `lastSeasonOfPlenty`                         | `0xbe6547d2` | Replace | Read |                   |
| `lastUpdate`                                 | `0xcb03fb1e` | Replace | Read |                   |
| `migrationNeeded`                            | `0xc38b3c18` | Replace | Read |                   |
| `seasonToStem`                               | `0x896ab1c6` | Replace | Read |                   |
| `stemStartSeason`                            | `0xbc771977` | Replace | Read |                   |
| `stemTipForToken`                            | `0xabed2d41` | Replace | Read |                   |
| `tokenSettings`                              | `0xe923e8d4` | Replace | Read |                   |
| `totalEarnedBeans`                           | `0xfd9de166` | Replace | Read |                   |
| `totalRoots`                                 | `0x46544166` | Replace | Read |                   |
| `totalStalk`                                 | `0x7b52fadf` | Replace | Read |                   |

### Convert Facet

The following `ConvertFacet` is removed from Beanstalk:

- [`0xedac366Acf56abbDe00B5149481B05cA7041f385`](https://etherscan.io/address/0xedac366Acf56abbDe00B5149481B05cA7041f385#code)

The following `ConvertFacet` is added to Beanstalk:

- [`0x1C55d002bf78Ced8cb4ebd8F4Cf39Ff93835C934`](https://etherscan.io/address/0x1C55d002bf78Ced8cb4ebd8F4Cf39Ff93835C934#code)

#### `ConvertFacet` Function Changes

| Name                  | Selector     | Action   | Type  | New Functionality |
|:----------------------|:-------------|:---------|:------|:------------------|
| `convert`             | `0xb362a6e8` | Replace  | Write | ✓                 |

### Enroot Facet

The following `EnrootFacet` is removed from Beanstalk:

- [`0x96FdD89272764100dE6dF791985Fd268204485C1`](https://etherscan.io/address/0x96FdD89272764100dE6dF791985Fd268204485C1#code)

The following `EnrootFacet` is added to Beanstalk:

- [`0x3780b8268F19118E7e44B9FEF6CA090bC5E077e6`](https://etherscan.io/address/0x3780b8268F19118E7e44B9FEF6CA090bC5E077e6#code)

#### `EnrootFacet` Function Changes

| Name                   | Selector     | Action  | Type  | New Functionality |
|:-----------------------|:-------------|:--------|:------|:------------------|
| `enrootDeposit`        | `0x0b58f073` | Replace | Write | ✓                 |
| `enrootDeposits`       | `0x88fcd169` | Replace | Write | ✓                 |

### Event Changes

None.

## Beans Minted

None.

## Effective

Effective immediately upon commitment by the BCM, which has already happened.