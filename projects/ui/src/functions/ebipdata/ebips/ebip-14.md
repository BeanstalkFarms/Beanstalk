Committed: February 5, 2024

## Submitter

Beanstalk Community Multisig

## Summary

* As a result of a potential attack vector around stealing Earned Beans during the Vesting Period:
    * Remove the Vesting Period logic altogether; and
    * Upgrade `withdrawDeposit(s)` to revert when called during the first 10 blocks of a Season.

## Links

Per the process outlined in the [BCM Emergency Response Procedures](https://docs.bean.money/almanac/governance/beanstalk/bcm-process#emergency-response-procedures), the BCM can take swift action to protect Beanstalk in the event of a bug or security vulnerability.

- [EBIP-14 GitHub PR](https://github.com/BeanstalkFarms/Beanstalk/pull/762)
- GitHub Commit Hash: [4f7f45832d2fd7b7d9e8ef81125f1392a307433c](https://github.com/BeanstalkFarms/Beanstalk/tree/4f7f45832d2fd7b7d9e8ef81125f1392a307433c)
- [Safe Transaction](https://app.safe.global/transactions/tx?safe=eth:0xa9bA2C40b263843C04d344727b954A545c81D043&id=multisig_0xa9bA2C40b263843C04d344727b954A545c81D043_0xbb405de87054477ac5beca741961d4d4cb229c801266d4d3b16a0c052f4a1465)
- [Etherscan Transaction](https://etherscan.io/tx/0x4b7e79cc9d02c8f75f250182d86ecf87b1c1afd5072d7fe05db187c8f5258e59)
- [Arweave](https://arweave.net/cOjwMRebYst6VrqXI-7h7S5-DrkuiT7cWRC4gBUak9s)

## Problem

A bug report was submitted on Immunefi that allowed a user to potentially steal unclaimed Earned Beans during the 10 block Vesting Period at the beginning of the Season, depending on the value of `s.newEarnedStalk`. 

This was due to an inconsistency in the number of `roots` minted when Depositing compared to the number of `roots` burnt when Withdrawing. By repeatedly Withdrawing and Depositing Beans, an attacker could increase the Stalk/`root` ratio and thus inflate their total Stalk balance before then calling `plant`. This attack could have been profitable based on the value of `s.newEarnedStalk`.

## Solution

Given that the Seed Gauge System replaces the Vesting Period, in the meantime the best route is to remove the Vesting Period logic altogether and revert when `withdrawDeposit(s)` is called during the first 10 blocks of the Season. 

At the time of execution of this EBIP, based on the value stored at `s.newEarnedStalk`, this attack was not profitable. However, the attack was profitable at various times over the last few months (i.e., some Earned Beans could be stolen for profit).

All changes were reviewed by Cyfrin.

## Contract Changes

### Season Facet

The following `SeasonFacet` is removed from Beanstalk:
* [`0x5eAfF0d247ee998bb4827B24292EAdC7f14f3EfC`](https://etherscan.io/address/0x5eAfF0d247ee998bb4827B24292EAdC7f14f3EfC#code)

The following `SeasonFacet` is added to Beanstalk:
* [`0x7667b52cbbe2D7CA54334C7c00F1396faF660DeA`](https://etherscan.io/address/0x7667b52cbbe2D7CA54334C7c00F1396faF660DeA#code)

#### `SeasonFacet` Function Changes

| Name                 | Selector     | Action  | Type | New Functionality |
|:---------------------|:-------------|:--------|:-----|:------------------|
| `abovePeg`           | `0x2a27c499` | Replace | View |                   |
| `curveOracle`        | `0x07a3b202` | Replace | View |                   |
| `paused`             | `0x5c975abb` | Replace | View |                   |
| `plentyPerRoot`      | `0xe60d7a83` | Replace | View |                   |
| `poolDeltaB`         | `0x471bcdbe` | Replace | View |                   |
| `rain`               | `0x43def26e` | Replace | View |                   |
| `season`             | `0xc50b0fb0` | Replace | View |                   |
| `seasonTime`         | `0xca7b7d7b` | Replace | View |                   |
| `sunriseBlock`       | `0x3b2ecb70` | Replace | View |                   |
| `time`               | `0x16ada547` | Replace | View |                   |
| `totalDeltaB`        | `0x06c499d8` | Replace | View |                   |
| `weather`            | `0x686b6159` | Replace | View |                   |
| `wellOracleSnapshot` | `0x597490c0` | Replace | View |                   |
| `gm`                 | `0x64ee4b80` | Replace | Call | ✓                 |
| `sunrise`            | `0xfc06d2a6` | Replace | Call | ✓                 |

### Silo Facet

The following `SiloFacet` is removed from Beanstalk:
* [`0xf4B3629D1aa74eF8ab53Cc22728896B960F3a74E`](https://etherscan.io/address/0xf4B3629D1aa74eF8ab53Cc22728896B960F3a74E#code)

The following `SiloFacet` is added to Beanstalk:
* [`0xFb33Af0Cc65d5dE71399c0A395846F53Fff76D71`](https://etherscan.io/address/0xFb33Af0Cc65d5dE71399c0A395846F53Fff76D71#code)

#### `SiloFacet` Function Changes

| Name                    | Selector     | Action  | Type | New Functionality |
|:------------------------|:-------------|:--------|:-----|:------------------|
| `balanceOf`             | `0x00fdd58e` | Replace | View |                   |
| `balanceOfBatch`        | `0x4e1273f4` | Replace | View |                   |
| `balanceOfDepositedBDV` | `0xbc8514cf` | Replace | View |                   |
| `balanceOfEarnedBeans`  | `0x3e465a2e` | Replace | View | ✓                 |
| `balanceOfEarnedStalk`  | `0x341b94d5` | Replace | View | ✓                 |
| `balanceOfGrownStalk`   | `0x8915ba24` | Replace | View |                   |
| `balanceOfPlenty`       | `0x896651e8` | Replace | View |                   |
| `balanceOfRainRoots`    | `0x69fbad94` | Replace | View |                   |
| `balanceOfRoots`        | `0xba39dc02` | Replace | View |                   |
| `balanceOfSop`          | `0xa7bf680f` | Replace | View |                   |
| `balanceOfStalk`        | `0x8eeae310` | Replace | View | ✓                 |
| `bdv`                   | `0x8c1e6f22` | Replace | View |                   |
| `getDeposit`            | `0x61449212` | Replace | View |                   |
| `getDepositId`          | `0x98f2b8ad` | Replace | View |                   |
| `getLastMowedStem`      | `0x7fc06e12` | Replace | View |                   |
| `getMowStatus`          | `0xdc25a650` | Replace | View |                   |
| `getSeedsPerToken`      | `0x9f9962e4` | Replace | View |                   |
| `getTotalDeposited`     | `0x0c9c31bd` | Replace | View |                   |
| `getTotalDepositedBDV`  | `0x9d6a924e` | Replace | View |                   |
| `grownStalkForDeposit`  | `0x3a1b0606` | Replace | View |                   |
| `inVestingPeriod`       | `0x0b2939d1` | Replace | View |                   |
| `lastSeasonOfPlenty`    | `0xbe6547d2` | Replace | View |                   |
| `lastUpdate`            | `0xcb03fb1e` | Replace | View |                   |
| `migrationNeeded`       | `0xc38b3c18` | Replace | View |                   |
| `seasonToStem`          | `0x896ab1c6` | Replace | View |                   |
| `stemStartSeason`       | `0xbc771977` | Replace | View |                   |
| `stemTipForToken`       | `0xabed2d41` | Replace | View |                   |
| `tokenSettings`         | `0xe923e8d4` | Replace | View |                   |
| `totalEarnedBeans`      | `0xfd9de166` | Replace | View |                   |
| `totalRoots`            | `0x46544166` | Replace | View |                   |
| `totalStalk`            | `0x7b52fadf` | Replace | View |                   |
| `claimPlenty`           | `0x45947ba9` | Replace | Call |                   |
| `deposit`               | `0xf19ed6be` | Replace | Call |                   |
| `mow`                   | `0x150d5173` | Replace | Call |                   |
| `mowMultiple`           | `0x7d44f5bb` | Replace | Call |                   |
| `plant`                 | `0x779b3c5c` | Replace | Call | ✓                 |
| `safeBatchTransferFrom` | `0x2eb2c2d6` | Replace | Call |                   |
| `safeTransferFrom`      | `0xf242432a` | Replace | Call |                   |
| `transferDeposit`       | `0x081d77ba` | Replace | Call |                   |
| `transferDeposits`      | `0xc56411f6` | Replace | Call |                   |
| `withdrawDeposit`       | `0xe348f82b` | Replace | Call | ✓                 |
| `withdrawDeposits`      | `0x27e047f1` | Replace | Call | ✓                 |

### Migration Facet

The following `MigrationFacet` is removed from Beanstalk:
* [`0x9F2444e6cFAAB6ea16Fc05B989f1017508F84A41`](https://etherscan.io/address/0x9F2444e6cFAAB6ea16Fc05B989f1017508F84A41#code)

The following `MigrationFacet` is added to Beanstalk:
* [`0xbE73a5C684B1b53d7C7758B9a614Bcfdb24f822d`](https://etherscan.io/address/0xbE73a5C684B1b53d7C7758B9a614Bcfdb24f822d#code)

#### `MigrationFacet` Function Changes

| Name                                     | Selector     | Action  | Type | New Functionality |
|:-----------------------------------------|:-------------|:--------|:-----|:------------------|
| `balanceOfGrownStalkUpToStemsDeployment` | `0x505f43ea` | Replace | View |                   |
| `balanceOfLegacySeeds`                   | `0x1be2cfd8` | Replace | View |                   |
| `getDepositLegacy`                       | `0xa9be1acb` | Replace | View |                   |
| `totalMigratedBDV`                       | `0x2b8cde0d` | Replace | View |                   |
| `mowAndMigrate`                          | `0x1f4f3d55` | Replace | Call |                   |
| `mowAndMigrateNoDeposits`                | `0xaed942e9` | Replace | Call |                   |

### Legacy Claim Withdrawal Facet

The following `LegacyClaimWithdrawalFacet` is removed from Beanstalk:
* [`0x93703ADC951B76451e3006960cFB3F927D7E7ef6`](https://etherscan.io/address/0x93703ADC951B76451e3006960cFB3F927D7E7ef6#code)

The following `LegacyClaimWithdrawalFacet` is added to Beanstalk:
* [`0xf6A39e7eF4605F47294aF93AA9eE8ee839D15292`](https://etherscan.io/address/0xf6A39e7eF4605F47294aF93AA9eE8ee839D15292#code)

#### `LegacyClaimWithdrawalFacet` Function Changes

| Name                | Selector     | Action   | Type | New Functionality |
|:--------------------|:-------------|:---------|:-----|:------------------|
| `claimWithdrawal`   | `0x488e94dc` | Replace  | Call |                   |
| `claimWithdrawals`  | `0x764a9874` | Replace  | Call |                   |
| `getTotalWithdrawn` | `0xb1c7a20f` | Replace  | View |                   |
| `getWithdrawal`     | `0xe23c96a4` | Replace  | View |                   |

### Convert Facet

The following `ConvertFacet` is removed from Beanstalk:
* [`0x7d19277B836D4787dC338251fbEd2e5841cF8c02`](https://etherscan.io/address/0x7d19277B836D4787dC338251fbEd2e5841cF8c02#code)

The following `ConvertFacet` is added to Beanstalk:
* [`0x38Dbe7445D3C51f27E41996de5b0EA19e3E47BA6`](https://etherscan.io/address/0x38Dbe7445D3C51f27E41996de5b0EA19e3E47BA6#code)

#### `ConvertFacet` Function Changes

| Name                         | Selector     | Action  | Type | New Functionality |
|:-----------------------------|:-------------|:--------|:-----|:------------------|
| `convert`                    | `0xb362a6e8` | Replace | Call |                   |

### Enroot Facet

The following `EnrootFacet` is removed from Beanstalk:
* [`0x1C2a836184d2fa7e4d0750Af73423a076cd169CE`](https://etherscan.io/address/0x1C2a836184d2fa7e4d0750Af73423a076cd169CE#code)

The following `EnrootFacet` is added to Beanstalk:
* [`0x5CB70cf085368698198CB45D517445d4413eB695`](https://etherscan.io/address/0x5CB70cf085368698198CB45D517445d4413eB695#code)

#### `EnrootFacet` Function Changes

| Name                   | Selector     | Action  | Type | New Functionality |
|:-----------------------|:-------------|:--------|:-----|:------------------|
| `enrootDeposit`        | `0x0b58f073` | Replace | Call |                   |
| `enrootDeposits`       | `0x88fcd169` | Replace | Call |                   |

### Event Changes

None.

## Beans Minted

None.

## Effective

Effective immediately upon commitment by the BCM, which has already happened.
