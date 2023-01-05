# BIP-7: Expanded Convert

- [Proposer](#proposer)
- [Summary](#summary)
- [Problem](#problem)
- [Proposed Solution](#proposed-solution)
- [Economic Rationale](#economic-rationale)
- [Effective](#effective)
- [Award](#award)


## Proposer:
Beanstalk Farms

## Summary:
- Allow Silo Members to Convert Deposited Beans to Deposited LP Tokens when P > 1.
- Allow Silo Members to Convert Deposited LP Tokens to Deposited Beans when P < 1.

## Problem:
The use of Uniswap V2 creates a robust, censorship resistant decentralized exchange for Beans, and a similarly robust and censorship resistant price oracle for Beanstalk. As compared to Curve or Uniswap V3, the x * y = k pricing curve creates excess price volatility for comparable volume. However, integrating Curve on Uniswap V3 directly into Beanstalk introduces non-trivial complexities and potential vulnerabilities. While Beanstalk Farms does intend to deploy an independent (not directly integrated into Beanstalk) BEAN:3CRV Curve pool in the next couple weeks, the efficiency of the current Uniswap V2 pool, and therefore the stability of the price of 1 Bean at $1, can be improved. 

## Proposed Solution:
By allowing Silo Members to Convert Deposited Beans to Deposited LP Tokens when P > 1, and  Deposited LP Tokens to Deposited Beans when P < 1, it allows Silo Members to manually arbitrage the Bean price in the BEAN:ETH Uniswap V2 pool without needing to Withdraw their assets from the Silo and forfeit Stalk. This should dramatically improve stability around $1 during major short term changes in supply or demand for Beans and/or Ether.

Silo Members who Convert Deposited Beans to Deposited LP Tokens when P > 1 will receive 2x Seeds on the Beans they Convert because LP Token Deposits receive 4 Seeds instead of 2 Seeds. There will be no Stalk lost, with the exception of a minor amount due to rounding (up to ~.01% of the Beans Converted).

Silo Members who Convert Deposited LP Tokens to Deposited Beans when P < 1 will lose Seeds because Deposited Beans get 2 Seeds instead of 4 Seeds. There will be a small loss of Stalk due to trading fees, but there is opportunity to buy Beans below peg and gain extra exposure to any upside in the Bean price. In instances where LP Tokens that were Deposited at a lower price are Converted, there is a loss of Stalk. Conversely, in instances where LP Tokens that were Deposited at a higher price are Converted,  there is a gain of Stalk. In instances where LP Tokens that were Deposited over half of the Seasons ago are Converted, there will be some loss of Stalk in order to prevent a Bean Deposit from being Deposited prior to Season 1.

Due to rounding and the fact that Bean has 6 decimals, the maximum a Convert can overshoot $1 in either direction is $0.0000005.

## Economic Rationale:
Creating efficient markets around Beanstalk assets is paramount to the long term success of Beanstalk. During periods of excess short term demand, there are many Beans Deposited in the Silo that cannot currently be sold above peg. This is inefficient. Similarly, during periods of short term excess supply, it is less efficient to maintain the same amount of liquidity with P < 1 than it is to have marginally less liquidity with P ≈ 1.

## Effective: 
Immediately upon commitment.

## Award:
6000 Beans to Beanstalk Farms to cover deployment costs.