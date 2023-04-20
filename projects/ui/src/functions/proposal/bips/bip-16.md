# BIP-16: Whitelist BEAN:LUSD Curve Pool

- [Proposer](#proposer)
- [Summary](#summary)
- [Proposal](#proposal)
- [Economic Rationale](#economic-rationale)
- [Technical Rationale](#technical-rationale)
- [Effective](#effective)

## Proposer:

Beanstalk Farms

## Summary:

Add the BEAN:LUSD Curve pool to the Silo whitelist for 1 Stalk and 3 Seeds per flash-loan-resistant Bean denominated value (BDV) Deposited.

## Proposal:

Add LP tokens for the BEAN:LUSD Curve pool (X) to the Silo whitelist.

**Token address:** 0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D

**BDV function:** The BDV of BEAN:LUSD LP tokens is calculated from the virtual price of X, the LUSD price in 3CRV derived from the LUSD:3CRV pool (lusd3CrvPrice), and the BEAN price in 3CRV derived from the BEAN:3CRV pool (bean3CrvPrice).

Both lusd3CrvPrice and bean3CrvPrice are calculated using the getY() function in the curve metapool contract using the reserves in the pools in the last block ($\Xi - 1$). 

We propose the BDV function for X is:
$$
BDV(x) = x * \text{virtual_price}(X) * \text{min}(1, \text{lusd3CrvPrice} / \text{bean3CrvPrice})
$$
**Stalk per BDV:** 1 Stalk per BDV.

**Seeds per BDV:** 3 Seeds per BDV.

## Economic Rationale:

Adding the BEAN:LUSD Curve pool to the Silo whitelist is beneficial to the success of both Beanstalk and Liquity. While the Silo’s yield should attract initial capital to the pool, the Stalk and Seed system incentivizes long-term liquidity that helps to further stabilize the prices of both BEAN and LUSD.

Over $300M in LUSD is currently deposited in Liquity's Stability Pool, earning ~6.3% APR from LQTY early adopter rewards at this time. The emission of these LQTY rewards follows a yearly halving schedule, and the Liquity Stability Pool holds more LUSD than is necessary to cover liquidations.

If BIP-16 is passed, the BEAN:LUSD pool’s inclusion in the Silo will offer LUSD holders the opportunity to directly participate in Beanstalk's governance and yield opportunities, providing additional utility to LUSD.

The pool is likely to attract capital from both BEAN holders and LUSD holders. The Silo’s Stalk and Seed system will reward long-term liquidity and should increase the stickiness of the capital in the pool. The pool also helps to decrease BEAN price deviations from peg and diversifies BEAN liquidity, increasing its correlation with a stable asset and reducing the correlation of its price with a more volatile asset like Ether.

The BEAN:LUSD Curve pool was launched on March 24, 2022, and currently holds over $500,000 in BEAN and LUSD. There is no capital requirement for a pool to be added to the Silo whitelist—the pool will be whitelisted upon the passage of this BIP.

## Technical Rationale:

By using the virtual price and the reserves in the last block, the BDV function is flash-loan-resistant.

## Effective:

Effective immediately upon commit.

## Reward:

5,000 Beans to Beanstalk Farms.