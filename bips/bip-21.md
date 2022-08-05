# BIP-21: Replant Beanstalk

- [Proposer](#proposer)
- [Quorum](#quorum)
- [Summary](#summary)
- [Problem](#problem)
- [Proposed Solution](#proposed-solution)
- [Rationale](#rationale)
- [Post Audit Changes](#post-audit-changes)
- [Effective](#effective)

# Proposer

Beanstalk Farms

# Quorum

50%: 106,664,659.23 Stalk

Two-thirds supermajority: 142,219,545.64 Stalk

# Summary

1. Execute a series of transactions to Replant Beanstalk.
2. Commit a series of upgrades to Beanstalk.
3. Unpause Beanstalk.

_Note: Any bugs found during testing will continue to be fixed throughout the BIP-21 Voting Period such that the Replant may not be delayed._

# Problem

BIP-21 addresses the following issues:

### 1. Beanstalk must be Replanted, which involves several steps.

* **_New ERC-20 tokens_:** The new Bean, Unripe Bean and Unripe BEAN:3CRV LP ERC-20 Tokens have not yet been deployed.
* **_New BEAN:3CRV pool_:** There is currently no liquidity pool in which the new Bean token can be traded.
* **_Remove old tokens from the Deposit Whitelist_:** The Deposit Whitelist still has the old Bean token and its associated LP Tokens. Leaving the old tokens on the Whitelist would pose security concerns to Beanstalk.
* **_Add new tokens to the Deposit Whitelist_:** The new Bean token, new BEAN:3CRV LP Token, Unripe Bean token and Unripe BEAN:3CRV LP Token have not yet been added to the Deposit Whitelist. 
* **_Minting Pool_:** The Oracle still uses the old BEAN:ETH liquidity pool when calculating deltaB.
* **_Minting Schedule_:** It is unclear how the market will value Bean initially, and the deltaB will be significantly above peg upon Replant.
* **_Flood_:** Flood is still based on the old BEAN:ETH liquidity pool.
* **_Deposit Earned Beans_:** Pre-exploit Earned Beans are not currently Deposited in any Season, which complicates accounting for them during the Replant.
* **_Stalk and Seed balances_:** Stalk and Seed balances are still in their pre-exploit state and must be updated to reflect the Barn Raise structure.
* **_Barn_:** Support for the Barn Raise as described in [BFP-72](https://snapshot.org/#/beanstalkfarms.eth/proposal/0xb87854d7f6f40f0877a1333028eab829b213fbcce03f16f9dd3832c8a98ab99b) has not yet been added to Beanstalk.
* **_Ratio at which Fertilizer sales add liquidity_:** Liquidity from Fertilizer sales must be added to the BEAN:3CRV pool at a particular ratio.

### 2. Beanstalk has improvements to the issues that have been audited for inclusion in the Replanted version of Beanstalk. 

* **_Oracle Whitelist_:** The current architecture to facilitate Bean/Soil minting each Season is not generalized or flexible. From a technical perspective, it should be straightforward to add and remove liquidity pools from the list of pools that facilitate Bean/Soil minting.
* **_Convert Whitelist_:** The current architecture to facilitate Conversions within the Silo is not generalized or flexible. From a technical perspective, it should be straightforward to add and remove Conversions from the list of possible Conversions within the Silo.
* **_Sub-optimal Conversion_:** Currently, when a Stalkholder Converts a Deposited LP token to a Deposited Bean, Grown Stalk from Seeds can be lost if the current BDV of the Deposit is lower than at the time of Deposit due to impermanent loss. This makes Converting unattractive when Beanstalk wants to encourage Conversions.
* **_Soil issued when P > 1_:** When P > 1, Beanstalk is currently willing to issue enough Soil such that if demand for Soil remains high, the total number of Pods stays the same from Season to Season, independent of the Pod Rate. A more sophisticated Soil supply schedule should account for the Pod Rate.
* **_FarmFacet and Internal Balances_:** Currently there is no flexible way to compose multiple interactions with Beanstalk together into a single transaction.
* **_Depot and Curve Pipeline_:** Beanstalk previously supported complex transactions with Uniswap and Beanstalk in a single transaction. The architecture to support these types of transactions is not generalized to also be able to interact with other protocols. 
* **_Withdrawal Freeze_:** The current 4 Season Withdrawal Freeze is an economic inefficiency that creates a supply overhang when there are Withdrawn assets.
* **_Deposit transferability_:** Deposits currently cannot be transferred from one address to another.
* **_Ownership transfer process_:** Ownership transfer of the Beanstalk contract is currently a one-step process and doesn’t require a claim by the receiving address.
* **_Division of Silo Reward Claiming_:** Silo Members cannot currently Mow Grown Stalk and Plant Plantable Seeds in separate transactions, even when it may be gas-efficient to do so.
* **_Minting of Plantable Seeds_:** Plantable Seeds are currently minted before being Planted, which is a suboptimal accounting practice.
* **_Contract ownership_:** Publius currently custodies ownership of the Beanstalk and Fertilizer contracts, and must transfer ownership of Beanstalk to the BCM and transfer ownership of the Fertilizer contracts to Beanstalk.

### 3. Beanstalk must be Unpaused.

* **_Unpause Beanstalk_:** A `sunrise()` function call is currently not accepted by Beanstalk.

# Proposed Solution

The following solutions are proposed to the issues listed above:

### 1. Execute a series of steps to Replant Beanstalk. 

* **_New ERC-20 tokens_:** Deploy and distribute new Bean, Unripe Bean and Unripe BEAN:3CRV LP ERC-20 Tokens.
    * Holders of Beans at the end of the block prior to the exploit received Unripe Beans at a 1:1 ratio. 
    * Holders of LP Tokens on the Deposit Whitelist that were not Deposited at the end of the block prior to the exploit received Unripe Φ at a ratio of 1 Unripe Φ per BDV of LP Tokens on the Deposit Whitelist held at the end of the block prior to the exploit. 
    * Holders of LP Tokens on the Deposit Whitelist that were Deposited at the end of the block prior to the exploit received Unripe Φ at a ratio of 1 Unripe Φ per the maximum of the BDV of the Deposit at the end of the block prior to the exploit and at the time of Deposit, per Deposit.
* **_New BEAN:3CRV pool_:** Deploy a new BEAN:3CRV metapool with an A parameter of 1 per [BFP-77](https://snapshot.org/#/beanstalkfarms.eth/proposal/0xbb1db9c60534b7aa3951ea0d7b107f755d555acdd95c495388be7a1bd7f494e0). Mint 100 Beans and add the 100 Beans and 100 USDC to the pool as initial liquidity.
* **_Remove old tokens from the Deposit Whitelist_:**
    * Remove the old Bean token.
    * Remove the old BEAN:3CRV LP Token.
    * Remove the old BEAN:ETH LP Token.
    * Remove the old BEAN:LUSD LP Token.
* **_Add new tokens to the Deposit Whitelist_:** For the BDV function, please refer to the appendix in the attached whitepaper. 
    * Add the new Bean token with 1 Stalk and 2 Seeds per BDV Deposited. 
    * Add the new BEAN:3CRV LP Token with 1 Stalk and 4 Seeds per BDV Deposited.
    * Add the Unripe Bean token with 1 Stalk and 2 Seeds per BDV Deposited. 
    * Add the Unripe BEAN:3CRV LP Token with 1 Stalk and 4 Seeds per BDV Deposited. 
* **_Minting Pool_:** Remove the old BEAN:ETH liquidity pool from the calculation of deltaB.
* **_Minting Schedule_:** Replant Beanstalk with a ramped minting schedule for Soil and Beans—deltaB will be equal to deltaB * R, where R starts at 0% and increases by 1% at the start of each Season for 100 Seasons after Replant.
* **_Flood_:** Remove the old BEAN:ETH liquidity pool from the Flood.
* **_Deposit Earned Beans_:** Distribute Earned Beans as Deposited Unripe Beans in Season 6074 upon Replant.
* **_Stalk and Seed balances_:** Recompute all Stalk and Seed balances.
    * A Stalkholder’s Stalk upon Replant is the percentage of Fertilizer sold prior to Replant times their Stalk at the end of the block prior to the exploit.
    * A Stalkholder’s Seeds upon Replant is the percentage of Fertilized sold prior to Replant times the sum of their Seeds at the end of the block prior to the exploit and their Plantable Seeds at the end of the block prior to the exploit.
    * Old BEAN:LUSD LP Token holders are credited as if they had more Seeds, as Unripe BEAN:3CRV LP receives 4 Seeds for Depositing in the Silo.
* **_Barn_:** Implement the full specifications of the Barn. For a full writeup of the Barn, please refer to the Barn section in the attached whitepaper. 
* **_Ratio at which Fertilizer sales add liquidity_:** Add liquidity from Fertilizer sales to the BEAN:3CRV pool at a ratio of 1:0.866616. 

### 2. Implement a series of improvements to Beanstalk.

* **_Oracle Whitelist_:** Move the Oracle to mint based on the Oracle Whitelist (the whitelist of liquidity pools whose deltaB’s are summed to calculate a cumulative deltaB), which upon Replant will consist solely of the new BEAN:3CRV metapool.
* **_Convert Whitelist_:** Introduce the Convert Whitelist, the generalized whitelist that determines which Conversions within the Silo are permitted under certain conditions. For full details on the Convert Whitelist, please refer to the appendix in the attached whitepaper. The following Conversions are whitelisted upon Replant:
    * Deposited Beans to Deposited BEAN:3CRV LP Tokens, when the Bean price in the BEAN:3CRV pool is greater than $1.
    * Deposited BEAN:3CRV LP tokens to Deposited Beans, when the Bean price in the BEAN:3CRV pool is less than $1.
    * Deposited Unripe Beans to Deposited Unripe BEAN:3CRV LP Tokens, when the Bean price in the BEAN:3CRV pool is greater than $1.
    * Deposited Unripe BEAN:3CRV LP Tokens to Deposited Unripe Beans, when the Bean price in the BEAN:3CRV pool is less than $1.
* **_Sub-optimal Conversion_:** When a Stalkholder Converts a Deposit, they update its Season of Deposit to retain its Grown Stalk from Seeds, and BDV only if it is higher than when it was Deposited.
* **_Soil issued when P > 1_:** Change the definition of $S_t^{min}$ to: 

$$S_t^{\text{min}} = \begin{cases} \dfrac{0.5 \times \Delta D_t}{1 + \frac{h_t}{100}} & \text{if} \; R^{D^{\text{upper}}} \leq R^D_{t-1}  \\ 
\dfrac{\Delta D_t}{1 + \frac{h_t}{100}} & \text{if} \; R^{D^{\text{lower}}} < R^D_{t-1}  \\ 
\dfrac{1.5 \times \Delta D_t}{1 + \frac{h_t}{100}} & \text{else} \end{cases}$$


* **_FarmFacet and Internal Balances_:** Introduce the FarmFacet and Internal (Farm) Balances that allow Farmers to compose transactions within Beanstalk together.
* **_Depot and Curve Pipeline_:** Add the Depot to the Farm. Add the Curve Pipeline to the Depot to enable interactions with Curve through Beanstalk.

The Curve Pipeline allows anyone to call functions in any pool registered in any of the following Curve registries.

* [0xB9fC157394Af804a3578134A6585C0dc9cc990d4](etherscan.io/address/0xB9fC157394Af804a3578134A6585C0dc9cc990d4#readContract)
* [0x90E00ACe148ca3b23Ac1bC8C240C2a7Dd9c2d7f5](etherscan.io/address/0x90E00ACe148ca3b23Ac1bC8C240C2a7Dd9c2d7f5#readContract)
* [0x8F942C20D02bEfc377D41445793068908E2250D0](etherscan.io/address/0x8F942C20D02bEfc377D41445793068908E2250D0#readContract)

The following functions to interact with Curve pools can be called through the Curve Pipeline:

```
function exchange(
    address pool, 
    address registry, 
    address fromToken, 
    address toToken, 
    uint256 amountIn, 
    uint256 minAmountOut, 
    LibTransfer.From fromMode, 
    LibTransfer.To toMode
) external payable nonReentrant;

// only in Metapools
function exchangeUnderlying(
    address pool, 
    address fromToken, 
    address toToken, 
    uint256 amountIn, 
    uint256 minAmountOut, 
    LibTransfer.From fromMode, 
    LibTransfer.To toMode
) external payable nonReentrant;

function addLiquidity(
    address pool,
    address registry,
    uint256[] memory amounts,
    uint256 minAmountOut,
    LibTransfer.From fromMode,
    LibTransfer.To toMode
) external payable nonReentrant;

function removeLiquidity(
    address pool,
    address registry,
    uint256 amountIn,
    uint256[] calldata minAmountsOut,
    LibTransfer.From fromMode,
    LibTransfer.To toMode
) external payable nonReentrant;

function removeLiquidityImbalance(
    address pool,
    address registry,
    uint256[] calldata amountsOut,
    uint256 maxAmountIn,
    LibTransfer.From fromMode,
    LibTransfer.To toMode
) external payable nonReentrant;

function removeLiquidityOneToken(
    address pool,
    address registry,
    address toToken,
    uint256 amountIn,
    uint256 minAmountOut,
    LibTransfer.From fromMode,
    LibTransfer.To toMode
) external payable nonReentrant;
```

* **_Withdrawal Freeze_:** Change x<sub>i</sub> from 4 Seasons to 0.
* **_Deposit transferability_:** Make Deposits transferable.
* **_Ownership transfer process_:** Implement a 2-step ownership transfer process.
* **_Division of Silo Reward Claiming_:** Introduce division of Silo Reward claiming. Mow claims Grown Stalk and Plant claims Plantable Seeds, Earned Stalk and Earned Beans.
* **_Minting of Plantable Seeds_:** Change Plantable Seeds to only be minted once Planted.
* **_Contract ownership_:** Transfer ownership of Beanstalk from Publius to the BCM and ownership of Fertilizer from Publius to Beanstalk.

### 3. Unpause Beanstalk.

* **_Unpause Beanstalk_:** The BCM will Unpause Beanstalk on August 6th, 2022 around 16:00 UTC.

# Rationale

The following are Beanstalk Farms’ rationale for the proposed solutions above:

### 1. Beanstalk must be Replanted, which involves several steps.

* **_New ERC-20 tokens_:** The new Bean token and Unripe assets must be deployed, per [BIP-20](https://snapshot.org/#/beanstalkdao.eth/proposal/0xe47741c4bfa4ac97ad23bbec0db8b9a5f2efc3e1737b309476d90611698193f4). They are distributed in accordance with [BFP-72](https://snapshot.org/#/beanstalkfarms.eth/proposal/0xb87854d7f6f40f0877a1333028eab829b213fbcce03f16f9dd3832c8a98ab99b).
* **_New BEAN:3CRV pool_:** The Beanstalk DAO approved BEAN:3CRV for the Replant Liquidity Pool in [BFP-75](https://snapshot.org/#/beanstalkfarms.eth/proposal/0xa3834c289604364a1cb0cddfc6397f89bb66fac673ca82e7869fee7167e92431) and an A parameter of 1 in [BFP-77](https://snapshot.org/#/beanstalkfarms.eth/proposal/0xbb1db9c60534b7aa3951ea0d7b107f755d555acdd95c495388be7a1bd7f494e0). 
* **_Remove old tokens from the Deposit Whitelist_:** The tokens on the old Deposit Whitelist used the exploited Bean token. Upon Replant, Beanstalk will use a new Bean token. Therefore, liquidity pools that utilize the old Bean token should be removed.
* **_Add new tokens to the Deposit Whitelist_:** In order for Farmers to be able to interact with the Silo, the new Bean token, new BEAN:3CRV LP Token, Unripe Bean token and Unripe BEAN:3CRV LP Token must be added to the Deposit Whitelist.
* **_Minting Pool_:** The old BEAN:ETH liquidity pool uses the old Bean token, and is therefore not relevant for the calculation of deltaB.
* **_Minting Schedule_:T**his minting schedule is conservative but with a quick ramp-up. The regular minting schedule of 100% will resume about 4 days after Replant. A ramped minting schedule allows time for Bean to price itself post-exploit.
* **_Flood_:** The old BEAN:ETH liquidity pool uses the old Bean token, and is therefore not relevant for the Flood.
* **_Deposit Earned Beans_:** The expectation for Silo Members is that they can always remain passive and earn Beans from Earned Stalk. Depositing Earned Beans in the current Season makes accounting for them during the Replant less complicated. Thus, Earned Beans are Deposited for pre-exploit Silo Members in the current Season.
* **_Stalk and Seed balances_:** Stalk and Seed balances should be haircut in accordance with [BFP-72](https://snapshot.org/#/beanstalkfarms.eth/proposal/0xb87854d7f6f40f0877a1333028eab829b213fbcce03f16f9dd3832c8a98ab99b). Depositors of old BEAN:LUSD LP tokens at the end of the block prior to the exploit were credited as having had 4 Seeds per BDV Deposited for the sake of simplicity. 
* **_Barn_:** Please refer to [BFP-72](https://snapshot.org/#/beanstalkfarms.eth/proposal/0xb87854d7f6f40f0877a1333028eab829b213fbcce03f16f9dd3832c8a98ab99b) for the rationale behind the implemented Barn mechanics.
* **_Ratio at which Fertilizer sales add liquidity_:** Liquidity that is recapitalized by the Barn Raise will be added to this pool at the ratio that would cause the deltaB to trend towards the pre-exploit deltaB in the Replant pool per [BFP-77](https://snapshot.org/#/beanstalkfarms.eth/proposal/0xbb1db9c60534b7aa3951ea0d7b107f755d555acdd95c495388be7a1bd7f494e0).

### 2. Commit a series of upgrades to Beanstalk.

* **_Oracle Whitelist_:** Moving the Oracle to mint based on the Oracle Whitelist is significantly more generalized and flexible than the previous minting architecture. 
* **_Convert Whitelist_:** Moving to a Convert Whitelist is significantly more generalized and flexible than the previous Convert architecture.
* **_Sub-optimal Conversion_:** When the value of Beans goes down, LP Token holders with Bean exposure realize impermanent loss, coinciding with the opportunity to Convert Deposited LP Tokens to Deposited Beans. Minimizing the cost for Stalkholders to Convert Deposited LP Tokens to Deposited Beans will minimize downside Bean price volatility.
* **_Soil issued when P > 1_:** By issuing more Soil when the Pod Rate is excessively low and less Soil when the Pod Rate is excessively high will improve Beanstalk’s ability to return the Pod Rate to its optimal level.
* **_FarmFacet and Internal Balances_:** The FarmFacet and Internal (Farm) Balances realize the full benefits of composability within Beanstalk.
* **_Depot and Curve Pipeline_:** The Depot is an extension of the composability of the FarmFacet to the rest of the Ethereum network. The Curve Pipeline is the first integration of this functionality between Beanstalk and another protocol. 
* **_Withdrawal Freeze_:** The Withdrawal Freeze creates a supply overhang when there are Withdrawn assets, which creates a market inefficiency. By lowering the Withdrawal Freeze to 0, assets are still Frozen until the beginning of the next Season. Therefore, the benefits of the Withdrawal Freeze are retained while the supply overhang is minimized.
* **_Deposit transferability_:** Deposits being non-transferable is an inefficiency for Silo Members and provides no benefit to Beanstalk. 
* **_Ownership transfer process_:** A 2-step ownership transfer process is safer than a 1-step ownership transfer process.
* **_Division of Silo Reward Claiming_:** Introducing the Mow and Plant functions allows for more customization for Silo Members when interacting with the Silo. 
* **_Minting of Plantable Seeds_:** It is not good accounting to include Plantable Seeds in the `balanceOfSeeds()` function.
* **_Contract ownership_:** Per [BFP-73](https://snapshot.org/#/beanstalkfarms.eth/proposal/0x7187da12eb07864d9f82f429feb49ea1cc9342755abe9831e81b294884307d2b), ownership of Beanstalk is being transferred to the BCM. Once Beanstalk is Replanted, it can own the Fertilizer contract.

### 3. Unpause Beanstalk.

* **_Unpause Beanstalk_:** Allow Beanstalk to accept `sunrise()` function calls.

# Post Audit Changes

The following changes have been made to Beanstalk, but have not been audited.

All relevant changes with the exception of `CurveFacet` and `LibUnripeSilo` can be viewed [here](https://github.com/BeanstalkFarms/Beanstalk/compare/post-audit...bip-21).


|File Name |Changes  | Type|
--- | --- | ---|
|`C.sol`|Changed constants.|Parameter Change|
|`CurveFacet.sol`|Most functionality—some were audited, but all have been heavily tested.|Bug Fix|
|`FertilizerFacet.sol`|Renamed variable; added `getCurrentHumidity()`.|Refactor / Usability|
|`FieldFacet.sol`|Moved burn token logic to LibTransfer's `burnToken()` function.|Refactor|
|`PauseFacet.sol`|Removed 2 unnecessary lines of code.|Clean Up|
|`Silo.sol`|Fixed an issue with the BDV of Earned Beans; removed unused variables.|Bug Fix|
|`TokenFacet.sol`|Removed an unnecessary variable.|Clean Up|
|`UnripeFacet.sol`|Renamed `ripen()` to `chop()`; renamed `claimUnripe()` to `pick()`; added Internal Balance support for `pick()` and `chop()`; added `picked()` function.|Refactor|
|`LibWhitelist.sol`|Removed BEAN_LUSD variables.|Clean Up|
|`LibTransfer.sol`|Added generalized `burnToken()` function with Internal Balance support.|Refactor|
|`LibUnripeSilo.sol`|Most functionality—some were audited, but all have been heavily tested.|Updated to account for Barn Raise changes|
|`LibCurveConvert.sol` / `LibMetaCurveConvert.sol` / `LibBeanMetaCurve.sol` / `LibCurve.sol`|Change the `lpToPeg()` function to account for Curve exchange fee.|Bug Fix|
|`FertilizerFacet.sol`|Added `getFertilizers()` function.|Usability|
|`LibCurveOracle.sol`|Added `MetapoolOracle` event.|Usability|
|`SeasonFacet.sol`|Moved `Sunrise` event call to the start of the `sunrise()` function instead of the end.|Refactor|
|`Weather.sol`|Added the Season number to Weather related events.|Refactor|
|`SiloFacet.sol`|Changed the `updateUnripeDeposit()` and `updateUnripeDeposits()` functions to `enrootDeposit()` and `enrootDeposits()`, respectively.| Refactor |

# Effective

After either:

1. A two-thirds supermajority is reached; or
2. The Voting Period ends and more than half of the total outstanding Stalk votes in favor of the BIP,

Publius will:

* Execute the remainder of the Water Treatment approved by BIP-20;
* Transfer ownership of Beanstalk to the BCM;
* Deploy BIP-21 related facets and initialization script;
* Propose the BIP-21 Diamond Cut to the BCM;
* Propose the approve transaction to use the BCM’s USDC; and
* Propose the addFertilizer transaction that adds the BCM’s USDC to the new BEAN:3CRV pool.

After that, the BCM will:

* Execute the BIP-21 Diamond Cut, which removes all existing function selectors and adds the new ones;
* Initialize Beanstalk;
* Execute the approve transaction to use the BCM’s USDC; and
* Execute the addFertilizer transaction.

The BCM will Unpause Beanstalk thereafter on August 6, 2022 at around 16:00 UTC. 

After the Unpause transaction and thus BIP-21 is fully executed, the BCM shall follow [the process for verifying proposed BIPs](https://docs.bean.money/governance/beanstalk/bcm-process#reviewing-and-signing-off-on-transactions) moving forward.
