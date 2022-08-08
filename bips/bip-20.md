# BIP-20: Migration of Balances

- [Proposer](#proposer)
- [Summary](#summary)
- [Problem](#problem)
- [Proposed Solution](#proposed-solution)
- [Rationale](#rationale)
- [Effective](#effective)
- [Quorum](#quorum)

## Proposer

Beanstalk Farms

## Summary

* Migrate the Beanstalk state to the pre-Replant state over the course of multiple transactions.

## Problem

As a result of the April 17, 2022 governance exploit, Beanstalk is in a corrupted state. The DAO has already approved the structure of the restart via [BFP-72](https://snapshot.org/#/beanstalkfarms.eth/proposal/0xb87854d7f6f40f0877a1333028eab829b213fbcce03f16f9dd3832c8a98ab99b). The Barn Raise began on June 6, 2022. Upon completion of the Trail of Bits and Halborn audits, the DAO will be able to vote to Replant Beanstalk. Migrating the Beanstalk state from its current state to the necessary state to Replant Beanstalk is a complicated process that will involve multiple transactions.

In accordance with [BFP-67](https://snapshot.org/#/beanstalkfarms.eth/proposal/0xedd9f9c4d5246b0de0c27dca2b37563baacc667bd5fa1b58b8d85d62c49f3293), all of the exploiters Deposits, Stalk, Seeds and Roots have already been removed. That transaction is [here](https://etherscan.io/tx/0xb155cc344e6cb75e435407c83b536e070ff24d1fe7abd5b2872f278a497a641a).

## Proposed Solution

There are several steps and transactions required to migrate Beanstalk from its current state to the pre-Replant state. 

### Distribute Unripe Beans

1. Deploy Unripe Bean token
2. Distribute non-Deposited Unripe Beans
    * Redistribute Wrapped Beans and Circulating Beans in the form of Claimable Unripe Beans
    * Remove all of the following assets redistribute them in the form of Claimable Unripe Beans
        * Harvestable Pods
        * Beans in Pod Orders
        * Withdrawn Beans
        * Farmable Beans
3. Remove all Deposited Beans and redistribute them in the form of Deposited Unripe Beans

### Distribute Unripe LP

4. Deploy Unripe LP Token
5. Distribute non-Deposited Unripe LP Tokens
    * Redistribute all Circulating LP Tokens in the form of Claimable Unripe LP Tokens
    * Remove all Withdrawn LP Tokens and redistribute them in the form of Claimable Unripe LP Tokens
6. Remove all Deposited LP Tokens and redistribute them in the form of Deposited Unripe LP Tokens

Those with Circulating or Withdrawn LP pre-exploit will receive LP based on the BDV of the token at the pre-exploit block:

Bean 3 Metapool Curve: 0.992035
Bean LUSD Plain Pool Curve: 0.983108
Bean:Eth Uniswap V2 Pool: 119,894,802.186829

### Final setup
7. Haircut Stalk, Seeds, Roots

## Rationale

Performing the migration in multiple steps will facilitate the simplest, safest and fastest  migration in anticipation of Beanstalk being Replanted. Requiring a BIP for each step would delay Replanting. 

## Effective

Publius and Beanstalk Farms will begin migration as soon as possible after either:

1. A two-thirds supermajority is reached; or
2. The voting period ends and more than half of the total outstanding Stalk as of block 14602789 (pre-exploit block) votes in favor of the BIP.

## Quorum

106,664,695 Stalk
