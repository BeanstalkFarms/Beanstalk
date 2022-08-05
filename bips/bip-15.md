# BIP-15: Demand for Soil Improvement

- [Proposer:](#proposer)
- [Summary:](#summary)
- [Problem:](#problem)
- [Proposed Solution:](#proposed-solution)
- [Technical Rationale:](#technical-rationale)
- [Economic Rationale:](#economic-rationale)
- [Effective:](#effective)
- [Glossary Terms:](#glossary-terms)

## Proposer:

Beanstalk Farms

## Summary:

- Change the way demand for Soil is measured in certain instances to account for the new Soil supply as implemented in BIPs 6 and 9.
- Add an option when Sowing Beans to Sow all remaining Soil available even if the Soil is less than the maximum amount a user was willing to Sow, or whether to only Sow if they can Sow the full amount.

## Problem:

The amount of Soil available each Season changes significantly from Season to Season. The current system to measure demand for Soil was designed based on the original Soil supply model, where there was typically a consistent amount of Soil available from Season to Season. Because this is no longer the case, Beanstalk measures demand for Soil in certain instances in a suboptimal fashion. 

Currently, if there is less Soil available than the amount of Soil someone was willing to Sow Beans into, their transaction fails. In instances where there is heavy competition for Soil, this can cause excess transaction failures, a suboptimal user experience, and an inefficiency in the Soil market.

## Proposed Solution:

We propose the following adjustment to the measurement of demand for Soil:

- The first time Beans are Sown in all but at most 1 Soil in a Season after one or more Seasons where Beans were not Sown in all Soil, demand for Soil is considered increasing.
- Use $\Delta E_{t}^{u^{\text{first}}}$, which logs the difference in time between the start of the $t$ and the first Sow in $t$ such that there is at most 1 remaining Soil, instead of $\Delta E_{t}^{u^{\text{last}}}$ to measure demand for Soil when all or almost all the Soil is Sown in a Season.
- If Beans were Sown in all but at most 1 Soil in the first 5 minutes of the previous Season (*i.e.*, $\Delta E_{t-1}^{u^{\text{first}}} \leq 300$), demand for Soil is considered increasing. If Beans were Sown in all but at most 1 Soil in both $t-1$ and  $t-2$, but $300 < \Delta E_{t-1}^{u^{\text{first}}}$, at the beginning of $t$ Beanstalk considers $\Delta E_{t}^{u}$ to measure demand for Soil.
- Change the definition of $\Delta E_{t}^{u}$  to: $\Delta E_{t}^{u} = \Delta E_{t-2}^{u^{\text{first}}} - \Delta E_{t-1}^{u^{\text{first}}}$.

## Technical Rationale:

Currently, the complex measurement of demand for Soil makes Sowing Beans expensive. This new system, where only the time of the first Sow in a Season such that there is at most 1 remaining Soil needs to be logged, is significantly more gas efficient. 

From a gas efficiency perspective, it is cheaper to fix the input currency into the transaction (*e.g.*, ETH) as opposed to the output (*e.g.*, Beans to Sow) such that there may be some small amount of Soil remaining at the end of a Sow. Logging the first timestamp such that there is at most 1 Soil remaining accounts for this potential remaining Soil. 

## Economic Rationale:

Under the new Soil supply parameters from BIPs 6 and 9, there is never any accumulation of Soil from Season to Season. Therefore, the only thing that matters to Beanstalk is whether it is attracting sufficient demand for all available Soil. The proposed changes to measuring demand for Soil reflect this more binary set of circumstances, while still preserving the three cases of changing demand for Soil.

The first time all but at most 1 Soil is Sown after a period of time when all but at most 1 Soil was not being Sown, demand should be considered increasing. Similarly, if all Soil is Sown at the beginning of consecutive Seasons, demand should be considered increasing. 

By moving away from the change in demand for Soil exclusively as a function of the amount of Soil available, the question then becomes when to start considering time, if at all. Once there are multiple consecutive Seasons where all Soil is Sown, the time it takes for all but at most 1 Soil to be Sown still provides high-quality data on changes in demand for Soil. 

## Effective:

Effective immediately upon commit.

## Glossary Terms:

Newly proposed definitions included in this glossary are not necessarily the same definitions in the current whitepaper. The following variable definitions are included here for clarity:

- $\Delta E_{t}^{u^{\text{first}}}$ - the difference between the Ethereum timestamp of the first Sow in $t$ such that there is at most one Soil available and the start of $t$.
- $\Delta E_{t}^{u}$ - the difference in time it took for the Beans to be Sown in all but at most one Soil over the previous two Seasons.