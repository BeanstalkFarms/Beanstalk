# BIP-12: Silo Generalization I

- [Proposer](#proposer)
- [Summary](#summary)
- [Problem](#problem)
- [Proposed Solution](#proposed-solution)
- [Economic Rationale](#economic-rationale)
- [Technical Rationale](#technical-rationale)
- [Effective](#effective)
- [Award](#award)

## Proposer:

Beanstalk Farms

## Summary:

- Upgrade the Silo to support arbitrary token Deposits, based on a token whitelist.
- Add the BEAN:3CRV Curve pool to the whitelist for 1 Stalk and 4 Seeds per Bean denominated value (BDV) Deposited.

## Problem:

The Silo currently only supports Deposits of Beans and LP Tokens for the BEAN:ETH Uniswap V2 pool. As the sophistication of the Beanstalk ecosystem increases, (*e.g.*, the BEAN:3CRV Curve pool) it is essential that the Silo can scale to accept arbitrary tokens.

## Proposed Solution:

The Silo will accept arbitrary token Deposits based on a token whitelist. Each token on the whitelist must include a formula for BDV, and the Stalk and Seed values per BDV Deposited. 

Tokens can be added to the Silo whitelist via BIP. Tokens on the whitelist can be Deposited, Withdrawn, and Claimed, but not Converted.

## Economic Rationale:

Incorporating other assets into the Silo via a whitelist allows Beanstalk to offer Stalk and Seed rewards to arbitrary liquidity pools, assets and protocols that are benefiting Beanstalk in some capacity. 

The BEAN:3CRV Curve Pool has started attracting liquidity, which has significantly decreased (1) price deviations from the value peg and (2) the correlation of the Bean and Ether prices. Offering Stalk and Seed rewards for Depositing the BEAN:3CRV Curve LP Tokens into the Silo is likely to both increase the stickiness of the capital currently in the pool and attract new liquidity to the pool.

## Technical Rationale:

In order for a token to be Deposited into the Silo, Beanstalk requires (1) the token address, (2) a formula to calculate the BDV of the tokens Deposited, (3) the number of Stalk per BDV Deposited, and (4) the Seeds per BDV Deposited. 

Supporting Deposits, Withdrawals, and Claims is the minimum functionality required to increase the assets that can be Deposited in the Silo. The ability to Convert arbitrary whitelisted tokens to other arbitrary whitelisted tokens with minimal loss of Stalk can be implemented in future BIPs to continue generalizing the Silo.

## Effective:

Effective immediately upon commit.

## Award:

5000 Beans to Beanstalk Farms.