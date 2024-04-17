Committed: September 13, 2022

## Submitter

Beanstalk Community Multisig

## Emergency Process Note

Per the process outlined in the [BCM Emergency Response Procedures](https://docs.bean.money/governance/beanstalk/bcm-process#emergency-response-procedures), an emergency hotfix may be implemented by an emergency vote of the BCM if the bug is minor and does not require significant code changes.

Note: Bugs or security vulnerabilities qualify as emergencies. Emergency action will not be taken for any reason related to the economic health of Beanstalk (like a bank run, for example).

## Links

* GitHub PR: https://github.com/BeanstalkFarms/Beanstalk/pull/92
* GitHub Commit Hash: [7168560db94426bbf736b4919a1ea4bccbdeab27](https://github.com/BeanstalkFarms/Beanstalk/commit/7168560db94426bbf736b4919a1ea4bccbdeab27)
* Gnosis Transaction: https://etherscan.io/tx/0x1ca14810306dfcb098950137f58b53a4034fe0f097985ea2403ec9d5de467076
* Arweave: https://arweave.net/3GyVJLO0YqhwJHWZeiykWYu4G6SsfcV0alP-1DfMygk

## Problem

After the Ethereum Merge occurs, multi-block MEV will be possible, allowing validators to manipulate TWAP oracles by moving the price orders of magnitude higher for at least 1 block in a risk free fashion by either adding 1-sided liquidity and/or buying all the Beans in the pool. For more information see here: [https://chainsecurity.com/oracle-manipulation-after-merge/](https://chainsecurity.com/oracle-manipulation-after-merge/).

Beanstalk currently uses a time weighted average oracle over the course of an hour to calculate deltaB, which determines the amount of Beans or Soil to mint each Season. Thus, node operators will have the potential to manipulate the number of Beans/Soil minted during a Season as soon as the merge happens.

**Such manipulation has 3 requirements:**

1. Control over at least 2 sequential block proposers;
2. Access to large capital to manipulate the price; and 
3. Sufficient incentive to pay the LP fee of moving the price up and down.

## Solution

We propose to implement a cap on the absolute value of time-weighted average deltaB on the Bean:3Crv pool of 1% of total Bean supply through an Emergency BIP as soon as possible.

### Rationale

Moving to a multi-block MEV resistant Oracle prior to the Merge is impractical because it would require either (1) creating a new off-chain Oracle, (2) modifying the existing on-chain Oracle or (3) migrating the liquidity to a new pool with a safer default Oracle. (1) A secure, decentralized off-chain Oracle that is capable of calculating the time weighted average deltaB (a metric unique to Beanstalk) over the course of a Season cannot be built trivially. (2) The existing Bean:3Crv pool is immutable, so upgrading the existing on-chain Oracle is not possible. (3) There does not exist an on-chain liquidity pool solution that has a multi-block MEV resistant oracle, so migrating liquidity is not an option. We are currently working on Beanstalk-native liquidity pools named Wells, which will have their own manipulation proof oracles. Therefore, changing Oracles is not feasible by the time the Merge occurs. 

Given the attack relies on the existence of a random event (requirement (1)), repeated manipulation requires either (1) significantly more capital to create more validators or (2) more time to allow the random event to happen twice.

Because the limit is a function of the Bean supply, it will scale with Beanstalk. Both price and total liquidity can be manipulated, so it cannot be implemented a limit as a function of price and liquidity. 

Putting limits on the Oracle result significantly decreases the maximum effect of such an attack in the short term given the difficulty of repeated manipulation. This functions as a short term solution. Bean:3Crv liquidity should be moved to a Beanstalk Well with a multi-block MEV resistant oracle once Wells are released.

## Remaining Vulnerability

The lack of a multi-block-MEV-resistant on-chain oracle for the Bean:3Crv pool means that a malicious actor could execute such manipulation every $b$ blocks if they control $p$ percent stake of Ether:

$$
b = \frac{p^{-2}-1}{1-p}
$$

Below is a chart showing some data of the estimated cost to execute the remaining vulnerability (*i.e.*, the cost to mint 1% of the Bean supply in Beans or Soil). 

| Ethereum Stake Ownership (p) | Est. Blocks between Opportunities (b) | Est. Days between Opportunities | Est. Eth Cost to Acquire* | Est. USD Cost to Acquire** |
| --- | --- | --- | --- | --- |
| 1% | 10100 | 1.4 | 143,353.55 | $243,316,847 |
| 0.5% | 40200 | 3.2 | 71,676.775 | $121,658,423 |
| 0.25% | 160400 | 22.8 | 35838.3875 | $60,829,211 |
| 0.1% | 1010000 | 139 | 14335.355 | $24,331,684 |

*Assumes total Ether staked of 14,335,355 Ether (https://ethereum.org/en/staking/).

**Assumes Ether price of ~$1700

The high cost to execute the attack and limited exposure to Beanstalk make the attack unattractive, but not impossible to execute. Therefore, it is important to migrate to a pool with a multi-block-MEV-resistant on-chain oracle for Bean:3Crv. 

## Effective

Effective upon commitment by the BCM. The Ethereum Merged is schedule as early as September 13th. There is not enough time to have the code reviewed by Halborn and have a BIP passed by the time the Ethereum Merge occurs.

## Functions to Change
- update `sunrise()` in `SeasonFacet`

## Issue

[#91](https://github.com/BeanstalkFarms/Beanstalk/issues/91)
