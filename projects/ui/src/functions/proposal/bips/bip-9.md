# BIP-9: Various Efficiency Improvements

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
- Decrease the Withdrawal Freeze twice a week for 6 weeks and then once a week for 8 weeks. After 14 weeks, the Withdrawal Freeze will be 4 Seasons.
- Decrease the consecutive Seasons of Rain before a Season of Plenty in line with the decreases in Withdrawal Freeze.
- Enable partial claim functionality to further leverage the benefits of BIP-2.
- Allow Silo Members to withdraw assets while having voted for active BIPs, and allow the BIP proposer to withdraw up to the minimum proposal threshold.
- Allow Silo Members to vote on multiple BIPs in a single transaction.
- Change the formula for the Soil at the start of each Season ($S_t^{\text{start}}$) to:

$$
S_t^{\text{start}} = \text{max}\left(-\Delta\bar{b}_{t-1}, \frac{h_t}{1+\frac{w}{100}}\right)
$$

- Change the inputs to the formulas for $\bar{b}_{t-1}^*$ and $\bar{b}_{t-1}$ (*i.e.*, $b_{t-1},\ y_{t-1}$)  to reflect the number of Beans and Y under the LP Tokens for the BEAN:Y liquidity pool in the Silo at the end of the previous Season.

## Problem:
As Beanstalk continues to demonstrate its ability to regularly oscillate the Bean price over its value peg, there are multiple opportunities to improve the efficiency of Beanstalk and the utility of Beans.

Withdrawal Freeze: The Withdrawal Freeze is largely designed to prevent a run on the Silo. As the Stalk System continues to demonstrate a strong effect on Silo Member’s behavior, encouraging long term deposits even during extended periods where P < 1, the Withdrawal Freeze can potentially be removed entirely. The first step in that direction is to gradually lower the Withdrawal Freeze.

SOP Timer: The Season of Plenty is designed to limit inorganic demand when P > 1. In order to be maximally effective, the consecutive Seasons of Rain before a Season of Plenty must be at most the same number of Seasons as the Withdrawal Freeze. Because the Withdrawal Freeze is decreasing, so too must the SOP timer.

Tax Efficiency: BIP-2 enabled the ability for a Silo Member or Bean Farmer to change their asset allocation within Beanstalk without any assets being sent to their wallet. Currently, to fully benefit from BIP-2, Silo Members and Bean Farmers must use all their claimable assets in a single transaction.  This causes friction, which leads to less efficient behavior.

Governance: Currently, when a Silo Member has voted for an active BIP, they cannot withdraw any funds from the Silo unless they unvote and then withdraw. To withdraw and continue to vote in favor of the BIP, they are required to make 3 transactions: unvote, withdraw, and vote. Similarly, a Silo Member that has proposed an active BIP cannot withdraw any of their assets, even if they would still have more Stalk than the minimum proposal threshold. This is unnecessary and limits participation in governance.

Silo Members cannot currently vote on more than one BIP in a single transaction. This can impose a higher than necessary cost on Silo Members to participate in governance when there are multiple active BIPs.

Soil: While the efficiency of the Soil market was improved when the Soil is less than the Minimum Soil Rate by BIP-6, the maximum Soil remains inefficient. The accumulation of Soil when there are consecutive Seasons with a TWAP < 1 causes Beanstalk to issue more Soil than is necessary to regularly oscillate the Bean price over its value peg. In general, Beanstalk should try to only issue the minimum amount of Soil necessary to return the price to its value peg when the TWAP is below it, or to sample demand for Soil when the TWAP is above it.

Silo LP: As the number of Beans held outside of the Silo increases, a minor attack vector ( 1. adding liquidity to the liquidity pool without depositing the liquidity in the pool, 2. immediately calling the sunrise function, and 3. removing the newly added liquidity from the pool) can cause Beanstalk to mint more Beans or Soil than necessary.

## Proposed Solution:
We propose minor tweaks to reduce friction within the ecosystem and improve efficiency and utility.

Withdrawal Freeze: We propose lowering the Withdrawal Freeze twice a week for 6 weeks (*i.e.*, until the Withdrawal Freeze is 12 full Seasons), every time the Season number (t) mod 84 == 0, and then once a week for 8 weeks every time t mod 168 == 0 (*i.e.*, until the Withdrawal Freeze is 4 full Seasons).

SOP Timer: **We propose decreasing the consecutive Seasons of Rain before a Season of Plenty in line with the decreases in Withdrawal Freeze.

Tax Efficiency: We propose allowing partial claims of Bean and LP Withdrawals, and Harvestable Pods.

Governance: We propose allowing Silo Members that have voted for one or more active BIPs to withdraw as much of their deposited assets as they desire without having to first unvote. The Stalk voted for any BIPs the Silo Member had outstanding votes for will be decremented by the amount of Stalk burned for the Withdrawal. Similarly, we propose allowing the proposer of an active BIP to withdraw assets up to the minimum proposal threshold (*i.e.*, the Withdrawal is permitted as long as the proposer’s Stalk is still greater as a percentage of the total Stalk supply than the minimum proposal threshold).

We propose allowing Silo Members to vote for more than one BIP in a single transaction.

Soil: We propose changing the formula for $S_t^{\text{start}}$ to:

$$
S_t^{\text{start}} = \text{max}\left(-\Delta\bar{b}_{t-1}, \frac{h_t}{1+\frac{w}{100}}\right)
$$

Silo LP: We propose changing the inputs to the formulas for $\bar{b}_{t-1}^*$ and $\bar{b}_{t-1}$ (currently $b_{t-1},\ y_{t-1}$)  to reflect the number of Beans and Y under the LP Tokens for the BEAN:Y liquidity pool in the Silo at the end of the previous Season.

## Economic Rationale:
Increasing the efficiency of Beanstalk and utility of Beans are both key to the long-term success of Beanstalk.

Withdrawal Freeze: A Withdrawal Freeze creates uncertainty about the price a Silo Member will receive for their Withdrawal. In conjunction with the Stalk System, this uncertainty helps prevent massive exodus from the Silo during extended periods when P < 1. As BIP-7 has been committed, while the length of the Withdrawal Freeze effects the amount of uncertainty, the marginal increase in uncertainty from an addition Season of Freeze is less than its marginal cost on Bean utility. Accordingly, slowly lowering the Withdrawal Freeze over the coming weeks will increase utility of Beans without significantly changing the incentive structure for Silo Members.

SOP Timer: The Season of Plenty is significantly less effective if it takes more Seasons of Rain than the Withdrawal Freeze, because then arbitrageurs can buy and deposit Beans, receive inflation rewards, withdraw and sell their Beans before a Season of Plenty can occur. In order to prevent this arbitrage opportunity, the SOP Timer must be at most the same as the Withdrawal Freeze. Accordingly, we propose keeping the SOP Timer equivalent to the Withdrawal Freeze as it is lowered.

Tax Efficiency: In general, a more efficient Beanstalk is preferred to a less efficient one. 

Governance: Making participation in governance as frictionless as possible will help maintain high levels of participation even as the distribution of Stalk becomes wore widespread.

Soil: Under the new proposed formula for $S_t^{\text{start}}$, Beanstalk will only issue the minimum Soil necessary to return the price to its value peg based on the TWAP of 1 Bean over the previous Season and the liquidity in the BEAN:ETH liquidity pool when the TWAP was < 1, and the maximum Soil possible without increasing the Pod Line over the course of that Season when the TWAP was > 1. This will allow Beanstalk to attract enough demand for Soil to regularly return the price to its value peg and accurately track demand for Soil without issuing more Pods than necessary. 

Silo LP: Currently, the attack vector can be executed without any exposure to the movement in the BEAN:ETH pool. Using the number of Beans and Y under the LP Tokens for the BEAN:Y liquidity pool in the Silo at the end of the previous Season will ensure efficient Bean and Soil mints, even as the number of hostile actors playing Beanstalk increases.

## Technical Rationale:
Tax Efficiency: This BIP introduces wrappedBean functionality in the Silo, such that when user has claimable Beans and uses only a portion of them in a transaction, they have the option whether or not to leave their Beans in a claimable state. 

## Effective:
Effective immediately upon commit.

## Award:
6000 Beans to Beanstalk Farms to cover deployment costs.
