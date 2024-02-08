Committed: December 9, 2022

## Submitter

Beanstalk Community Multisig

## Emergency Process Note

Per the process outlined in the [BCM Emergency Response Procedures](https://docs.bean.money/almanac/governance/beanstalk/bcm-process#emergency-response-procedures), the BCM can take swift action to protect Beanstalk in the event of a bug or security vulnerability.

## Links

- [GitHub PR](https://github.com/BeanstalkFarms/Beanstalk/pull/170)
- [Safe Transaction](https://app.safe.global/eth:0xa9bA2C40b263843C04d344727b954A545c81D043/transactions/tx?id=multisig_0xa9bA2C40b263843C04d344727b954A545c81D043_0x4e75e48f9b4695dd5e2050eac60fc84aa3d07f51f42f8044f9aa29a7c4512c4e)
- [Etherscan Transaction](https://etherscan.io/tx/0xce278f3e8bcffe9391806ab85b271788bcb0df782bdc02a3e862b09beb90e2e9)
- [Arweave](https://arweave.net/XulSo-1AWwFlmbs2Ck1kjsCXZIZbrnqpErHh8aXbIfw)

## Problem

The `enrootDeposit(s)` functions could Enroot any tokens on the Deposit Whitelist. Only Unripe tokens on the Deposit Whitelist should be able to be Enrooted. 

The difference between `enrootDeposit(s)` and  λ → λ Converts is that `enrootDeposit(s)` credits the Grown Stalk received from the additional BDV while λ → λ Converts do not.

Thus, BEAN3CRV LP Depositors could Enroot their BEAN3CRV LP Deposits when the BDV was higher and receive excess Grown Stalk.

The impact of this was marginal, particularly given that this is only possible with BEAN3CRV LP, but when `deltaB < 0` it was possible to take advantage of the issue.

## Solution

Add the following check to the `enrootDeposit(s)` functions: 

```
require(s.u[token].underlyingToken != address(0), "Silo: token not unripe");
```

## Contract Changes

### Silo Facet

The following `SiloFacet` is still part of Beanstalk:
* [`0xf73db3fb33c7070db0f0ae4a76872251dca15e97`](https://etherscan.io/address/0xf73db3fb33c7070db0f0ae4a76872251dca15e97#code)

The following `SiloFacet` is added to Beanstalk:
* [`0xeD7bE52F59B4aA0c36b046E5c1F14Df62aaE79D6`](https://etherscan.io/address/0xeD7bE52F59B4aA0c36b046E5c1F14Df62aaE79D6#code)

#### `SiloFacet` Function Changes

|    Name          |   Selector   |  Action   | Type | New Functionality |
|:-----------------|:-------------|:----------|:-----|:------------------|
| `enrootDeposit`  | `0xd5d2ea8c` |  Replace  | Call |      ✓            |
| `enrootDeposits` | `0x83b9e85d` |  Replace  | Call |      ✓            |

#### `SiloFacet` Event Changes

None.

## Effective

Effective immediately upon commit by the BCM, which has already happened.
