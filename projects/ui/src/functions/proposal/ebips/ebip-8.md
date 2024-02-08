Committed: May 13, 2023

## Submitter

Beanstalk Community Multisig

## Emergency Process Note

Per the process outlined in the [BCM Emergency Response Procedures](https://docs.bean.money/almanac/governance/beanstalk/bcm-process#emergency-response-procedures), the BCM can take swift action to protect Beanstalk in the event of a bug or security vulnerability.

## Links

- [EBIP-8 GitHub PR](https://github.com/BeanstalkFarms/Beanstalk/pull/389)
- GitHub Commit Hash: [c6425b4e5ea6597a97e41a934583a31f4bf807ee](https://github.com/BeanstalkFarms/Beanstalk/pull/389/commits/c6425b4e5ea6597a97e41a934583a31f4bf807ee)
- [Safe Transaction](https://app.safe.global/transactions/tx?safe=eth:0xa9bA2C40b263843C04d344727b954A545c81D043&id=multisig_0xa9bA2C40b263843C04d344727b954A545c81D043_0x250bd3ef43d5d621905ade02204da27eafc06c0d97bd774fd0b7ceead93c2f31)
- [Etherscan Transaction](https://etherscan.io/tx/0x22e529e7f7a4f9b530586d02befd70ff471d925e5f7e373d2395f8b81c061bc4)
- [Arweave](https://arweave.net/bnLvAXT1eM2vVh76iPXU-k71PPJ4KxGIz-StF5KqY-c)

## Problem

The `enrootDeposit(s)` functions increment Seeds based on the BDV of the total amount Enrooted instead of the sum of BDV of the amount Enrooted in each individual Season. This causes a slight discrepancy between the total Seeds that a Farmer has and the amount of BDV they have deposited for each token.

Removing an Unripe Deposit can cause a BDV rounding error due to the way that Beanstalk computes the BDV using legacy Silo Deposits. Any function that removes a Unripe Deposit could potentially have this rounding error.

The `enrootDeposit(s)` functions do not have the `payable` modifier. This implies that `farm` functions using Ether cannot access the `enrootDeposit(s)` functions.

## Impact

The combination of problems (1) and (2) have led to a total discrepancy of 0.026151784 Stalk and 0.048628 Seeds.

## Solution

Increment the total Seeds based on the sum of the BDV of each Enrooted Deposit in `enrootDeposit`.

When removing an Unripe Deposit from the legacy Silo storage reference, remove the whole legacy Deposit and redeposit any excess in the regular Silo storage reference instead of leaving it in the legacy Deposit storage.

Add the `payable` modifer to the `enrootDeposit(s)` functions.

All fixes were reviewed by Halborn.

## Contract Changes

### Silo Facet

The following `SiloFacet`s have been removed from Beanstalk:
* [`0xf73db3fb33c7070db0f0ae4a76872251dca15e97`](https://etherscan.io/address/0xf73db3fb33c7070db0f0ae4a76872251dca15e97#code)
* [`0xeD7bE52F59B4aA0c36b046E5c1F14Df62aaE79D6`](https://etherscan.io/address/0xeD7bE52F59B4aA0c36b046E5c1F14Df62aaE79D6#code)

The following `SiloFacet` has been added to Beanstalk:
* [`0xE56607C4396c546cB6a137659e42A5Fd16e17CFE`](https://etherscan.io/address/0xE56607C4396c546cB6a137659e42A5Fd16e17CFE#code)

#### `SiloFacet` Function Changes

|  Name                            |  Selector     |  Action   | Type | New Functionality |
|:---------------------------------|:--------------|:----------|:-----|:------------------|
| `approveDeposit`                 | `0x1302afc2`  |  Replace  | Call |                   |
| `balanceOfEarnedBeans`           | `0x3e465a2e`  |  Replace  | View |                   |
| `balanceOfEarnedSeeds`           | `0x602aa123`  |  Replace  | View |                   |
| `balanceOfEarnedStalk`           | `0x341b94d5`  |  Replace  | View |                   |
| `balanceOfGrownStalk`            | `0x249564aa`  |  Replace  | View |                   |
| `balanceOfPlenty`                | `0x896651e8`  |  Replace  | View |                   |
| `balanceOfRainRoots`             | `0x69fbad94`  |  Replace  | View |                   |
| `balanceOfRoots`                 | `0xba39dc02`  |  Replace  | View |                   |
| `balanceOfSeeds`                 | `0x4916bc72`  |  Replace  | View |                   |
| `balanceOfSop`                   | `0xa7bf680f`  |  Replace  | View |                   |
| `balanceOfStalk`                 | `0x8eeae310`  |  Replace  | View |                   |
| `claimPlenty`                    | `0x45947ba9`  |  Replace  | Call |                   |
| `claimWithdrawal`                | `0x488e94dc`  |  Replace  | Call |                   |
| `claimWithdrawals`               | `0x764a9874`  |  Replace  | Call |                   |
| `decreaseDepositAllowance`       | `0xd9ee1269`  |  Replace  | Call |                   |
| `deposit`                        | `0xf19ed6be`  |  Replace  | Call |                   |
| `depositAllowance`               | `0x2a6a8ef5`  |  Replace  | View |                   |
| `depositPermitDomainSeparator`   | `0x8966e0ff`  |  Replace  | View |                   |
| `depositPermitNonces`            | `0x843bc425`  |  Replace  | View |                   |
| `enrootDeposit`                  | `0xd5d2ea8c`  |  Replace  | View |  &check;          |
| `enrootDeposits`                 | `0x83b9e85d`  |  Replace  | View |  &check;          |
| `getDeposit`                     | `0x8a6a7eb4`  |  Replace  | View |                   |
| `getTotalDeposited`              | `0x0c9c31bd`  |  Replace  | View |                   |
| `getTotalWithdrawn`              | `0xb1c7a20f`  |  Replace  | View |                   |
| `getWithdrawal`                  | `0xe23c96a4`  |  Replace  | View |                   |
| `increaseDepositAllowance`       | `0x5793e485`  |  Replace  | Call |                   |
| `lastSeasonOfPlenty`             | `0xbe6547d2`  |  Replace  | View |                   |
| `lastUpdate`                     | `0xcb03fb1e`  |  Replace  | View |                   |
| `permitDeposit`                  | `0x120b5702`  |  Replace  | Call |                   |
| `permitDeposits`                 | `0xd5770dc7`  |  Replace  | Call |                   |
| `plant`                          | `0x779b3c5c`  |  Replace  | Call |                   |
| `tokenSettings`                  | `0xe923e8d4`  |  Replace  | View |                   |
| `totalEarnedBeans`               | `0xfd9de166`  |  Replace  | View |                   |
| `totalRoots`                     | `0x46544166`  |  Replace  | View |                   |
| `totalSeeds`                     | `0xd8bd0d9d`  |  Replace  | View |                   |
| `totalStalk`                     | `0x7b52fadf`  |  Replace  | View |                   |
| `transferDeposit`                | `0x9e32d261`  |  Replace  | Call |                   |
| `transferDeposits`               | `0x0d2615b1`  |  Replace  | Call |                   |
| `update`                         | `0x1c1b8772`  |  Replace  | Call |                   |
| `withdrawDeposit`                | `0x7af9a0ce`  |  Replace  | Call |                   |
| `withdrawDeposits`               | `0xb189d9c8`  |  Replace  | Call |                   |
| `withdrawFreeze`                 | `0x55926690`  |  Replace  | View |                   |
    
#### `SiloFacet` Event Changes

None.

### Convert Facet

The following `ConvertFacet` has been removed from Beanstalk:
* [`0xc2e90acba1dc5ec1b852592390f479012eb304c2`](https://etherscan.io/address/0xc2e90acba1dc5ec1b852592390f479012eb304c2#code)

The following `ConvertFacet` has been added to Beanstalk:
* [`0xD24959190e29b13e1acCb578D02b15D73a2231F3`](https://etherscan.io/address/0xD24959190e29b13e1acCb578D02b15D73a2231F3#code)

#### `ConvertFacet` Function Changes

|  Name             |  Selector     |  Action   | Type | New Functionality |
|:------------------|:--------------|:----------|:-----|:------------------|
| `convert`         | `0x3b2a1b28`  |  Replace  | Call |                   |
| `getAmountOut`    | `0x4aa06652`  |  Replace  | View |                   |
| `getMaxAmountIn`  | `0x24dd285c`  |  Replace  | View |                   |

#### `ConvertFacet` Event Changes

None.

## Effective

Immediately upon commitment by the BCM, which has already happened.
    
