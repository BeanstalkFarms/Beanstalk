# BIP-24: Fungible BDV Support

- [Proposer](#proposer)
- [Summary](#summary)
- [Problem](#problem)
- [Proposed Solution](#proposed-solution)
- [Technical Rationale](#technical-rationale)
- [Economic Rationale](#economic-rationale)
- [Modified Functions](#modified-functions)
- [Proposer Award](#proposer-award)
- [Audit](#audit)
- [Effective](#effective)

## Proposer:

Root Labs

## Summary:

- Add $\lambda$ -> $\lambda$ converts;
- Allow Farmers to delegate the ability to transfer their Deposits to other addresses;
- Add a new implementation of the `chop(...)` function;
- Add return values to the `convert` and `transferDeposit(s)` functions;
- Add `StalkBalanceChanged` and `SeedsBalanceChanged` events on Deposit transfers; and
- Emit `StalkBalanceChanged` and `SeedsBalanceChanged` events for all historical `transferDeposit(s)` function calls in a second transaction.

## Problem:

Currently, Deposits cannot be Converted to Deposits of the same $\lambda$. This prevents Silo members from updating the BDV of their LP tokens when their BDV increases due to impermanent loss, which is an inefficiency for Farmers. Furthermore, this prevents the combining of multiple Deposits of the same $\lambda$ into a single Season, which is a friction around interoperability.

Currently, Farmers cannot delegate other addresses to transfer Deposits on their behalf. This makes interoperability with other contracts difficult, particularly with regard to the implementation of a fungible bean denominated value ERC-20 Token contract.

The `chop(...)` function was removed in EBIP-1 in response to a vulnerability discovered by Halborn. Accordingly, there is currently no way for Farmers to Chop their Unripe assets.

The lack of return values for both the `convert` and `transferDeposit(s)` functions makes it difficult for other smart contracts calling Beanstalk to track balance changes.

Similarly, the lack of `StalkBalanceChanged` and `SeedsBalanceChanged` events on Deposit transfers makes it difficult for other smart contracts calling Beanstalk to track balance changes.

## Proposed Solution:

We propose adding $\lambda$ -> $\lambda$ converts to the Convert Whitelist. When Converting a single Deposit, the only effect will be to update its BDV if it has increased. When Converting more than 1 Deposit, their BDV are updated and their Seasons of Deposit are combined into a new Season of Deposit weighted by BDV. 

$\lambda \rightarrow \lambda$
1. ***From Token Address:*** The from token address must match the to token address.
2. ***To Token Address:*** The to token address must match the from token address.
3. ***Conditions:*** *Deposited* $\lambda$ can be *Converted* to a $\lambda$ *Deposit* at anytime. 
4. ***Convert Function:*** The number of $\lambda$ received for *Converting* *Deposited* $\lambda$ within the *Silo* is equivalent to the number of $\lambda$ *Converted*. Therefore, we define  function as:
$$f^{\lambda \rightarrow \lambda}(z^{\lambda}) = z^{\lambda}$$

We propose allowing Farmers to delegate other addresses to transfer Deposits on their behalf.

We propose adding a new implementation of the `chop(...)` function.

We propose adding return values to both the `convert` and `transferDeposit(s)` functions.

We propose emitting `StalkBalanceChanged` and `SeedsBalanceChanged` events on Deposit transfers.

We prepose the one time emission of historical `StalkBalanceChanged` and `SeedsBalanceChanged` events on previous Deposit transfers after committment of the BIP.

## Technical Rationale:

The delegation of the ability to transfer Deposits greatly improves the composability of Beanstalk. For example, the Fungible Deposited Bean Denominated Value ERC-20 Token contract requires the Deposit approval system. 

A new implementation of the `chop(...)` function has been audited by Halborn.

Adding return values for both the `convert` and `transferDeposit(s)` functions makes it much easier for other smart contracts calling Beanstalk to track balance changes.

Similarly, adding `StalkBalanceChanged` and `SeedsBalanceChanged` events on Deposit transfers makes it much easier for other smart contracts calling Beanstalk to track balance changes.

Emitting `StalkBalanceChanged` and `SeedsBalanceChanged` events for all historical `transferDeposit(s)` function calls will be done in a separate transaction to ensure all events are emitted because there can be `transferDeposit(s)` function calls made between proposal of the BIP and its committment. 

## Economic Rationale:

The ability to update BDV of a Deposit removes the potential friction around Withdrawing and reDepositing the same assets again to claim the updated BDV. 

Improving the composability of Beanstalk should improve the utility of Beans. 

The `chop(...)` function is an essential part of the Barn as constructed approved by the DAO. 


## Contract Changes

The following callable functions are added to Beanstalk:
- `chop()`
- `approveDeposit()`
- `increaseDepositAllowance()`
- `decreaseDepositAllowance()`

The following callable function are changed within Beanstalk:
- `transferDeposit()`
- `transferDeposits()`
- `claimPlenty()`
- `convert()`

The following view functions are added to Beanstalk:
- `_getPenalizedUnderlying()`
- `depositAllowance()`

The following view functions are changed within Beanstalk:
- `getUnderlying()`
- `getPenalizedUnderlying()`

The following event is added to Beanstalk:
- `DepositApproval()`

## Audit:

The commit hash of this BIP is [6699e071626a17283facc67242536037989ecd91](https://github.com/BeanstalkFarms/Beanstalk/tree/6699e071626a17283facc67242536037989ecd91). 

Halborn has performed an audit of this commit hash. 

You can view the Halborn audit report of this commit hash on Arweave here: https://arweave.net/9CX_DCDceBugfmpHhxlL85gkCn-4Yu0eQQQsZ9ckY8w

## Proposer Award:

10,000 Beans.

## Effective:

Effective immediately upon commit. The historical event emissions will be made immediately after commit. 
