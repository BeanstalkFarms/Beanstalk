// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title System
 * @notice Stores system-level Beanstalk state.
 * @param paused True if Beanstalk is Paused.
 * @param pausedAt The timestamp at which Beanstalk was last paused.
 * @param reentrantStatus An intra-transaction state variable to protect against reentrance.
 * @param isFarm Stores whether the function is wrapped in the `farm` function (1 if not, 2 if it is).
 * @param ownerCandidate Stores a candidate address to transfer ownership to. The owner must claim the ownership transfer.
 * @param sopWell Stores the well that will be used upon a SOP. Uninitialized until a SOP occurs, and is kept constant afterwards.
 * @param plenty The amount of plenty token held by the contract.
 * @param _buffer_0 Reserved storage for future additions.
 * @param podListings A mapping from Plot Index to the hash of the Pod Listing.
 * @param podOrders A mapping from the hash of a Pod Order to the amount of Pods that the Pod Order is still willing to buy.
 * @param internalTokenBalanceTotal Sum of all users internalTokenBalance.
 * @param wellOracleSnapshots A mapping from Well Oracle address to the Well Oracle Snapshot.
 * @param twaReserves A mapping from well to its twaReserves. Stores twaReserves during the sunrise function. Returns 1 otherwise for each asset. Currently supports 2 token wells.
 * @param usdTokenPrice A mapping from token address to usd price.
 * @param sops A mapping from Season to Plenty Per Root (PPR) in that Season. Plenty Per Root is 0 if a Season of Plenty did not occur.
 * @param _buffer_1 Reserved storage for future additions.
 * @param casesV2 Stores the 144 Weather and seedGauge cases.
 * @param weather See {Weather}.
 * @param season See {Season}.
 * @param silo See {Silo}.
 * @param field See {Field}.
 * @param fert See {Fertilizer}.
 * @param seedGauge Stores the seedGauge.
 * @param rain See {Rain}.
 * @param _buffer_2 Reserved storage for future additions.
 */
struct System {
    bool paused;
    uint128 pausedAt;
    uint256 reentrantStatus;
    uint256 isFarm;
    address ownerCandidate;
    address sopWell;
    uint256 plenty;
    bytes32[16] _buffer_0;
    mapping(uint256 => bytes32) podListings;
    mapping(bytes32 => uint256) podOrders;
    mapping(IERC20 => uint256) internalTokenBalanceTotal;
    mapping(address => bytes) wellOracleSnapshots;
    mapping(address => TwaReserves) twaReserves;
    mapping(address => uint256) usdTokenPrice;
    mapping(uint32 => uint256) sops; // TODO rename / move
    bytes32[16] _buffer_1;
    bytes32[144] casesV2;
    Silo silo;
    Field field;
    Fertilizer fert;
    Season season;
    Weather weather;
    SeedGauge seedGauge;
    Rain rain;
    bytes32[128] _buffer_2;
}

/**
 * @notice System-level Silo state variables.
 * @param stalk The total amount of active Stalk (including Earned Stalk, excluding Grown Stalk).
 * @param roots The total amount of Roots.
 * @param earnedBeans The number of Beans distributed to the Silo that have not yet been Deposited as a result of the Earn function being called.
 * @param siloBalances A mapping from Token address to Silo Balance storage (amount deposited and withdrawn).
 * @param assetSettings A mapping from Token address to Silo Settings for each Whitelisted Token. If a non-zero storage exists, a Token is whitelisted.
 * @param unripe Unripe Settings for a given Token address. The existence of a non-zero Unripe Settings implies that the token is an Unripe Token. The mapping is from Token address to Unripe Settings.
 * @param whitelistStatuses Stores a list of Whitelist Statues for all tokens that have been Whitelisted and have not had their Whitelist Status manually removed.
 * @param germinating Mapping from odd/even to token to germinating deposits data.
 * @param unclaimedGerminating A mapping from season to object containing the stalk and roots that are germinating.
 * @param _buffer Reserved storage for future expansion.
 * @dev seeds are no longer used internally. Balance is wiped to 0 from the mayflower update. see {mowAndMigrate}.
 */
struct Silo {
    uint256 stalk;
    uint256 roots;
    uint256 earnedBeans;
    mapping(address => AssetSilo) balances;
    mapping(address => AssetSettings) assetSettings;
    // Unripe
    mapping(address => UnripeSettings) unripeSettings;
    WhitelistStatus[] whitelistStatuses;
    mapping(GerminationSide => mapping(address => Deposited)) germinating;
    mapping(uint32 => GerminatingSilo) unclaimedGerminating;
    bytes32[8] _buffer;
}

/**
 * @notice System-level Field state variables.
 * @param soil The number of Soil currently available. Adjusted during {Sun.stepSun}.
 * @param beanSown The number of Bean sown within the current Season. Reset during {Weather.calcCaseId}.
 * @param pods The pod index; the total number of Pods ever minted.
 * @param harvested The harvested index; the total number of Pods that have ever been Harvested.
 * @param harvestable The harvestable index; the total number of Pods that have ever been Harvestable. Included previously Harvested Beans.
 * @param _buffer Reserved storage for future expansion.
 */
struct Field {
    uint128 soil;
    uint128 beanSown;
    uint256 pods;
    uint256 harvested;
    uint256 harvestable;
    bytes32[8] _buffer;
}

/**
 * @notice Fertilizer data.
 * @param fertilizer A mapping from Fertilizer Id to the supply of Fertilizer for each Id.
 * @param nextFid A linked list of Fertilizer Ids ordered by Id number. Fertilizer Id is the Beans Per Fertilzer level at which the Fertilizer no longer receives Beans. Sort in order by which Fertilizer Id expires next.
 * @param activeFertilizer The number of active Fertilizer.
 * @param fertilizedIndex The total number of Fertilizer Beans.
 * @param unfertilizedIndex The total number of Unfertilized Beans ever.
 * @param fertilizedPaidIndex The total number of Fertilizer Beans that have been sent out to users.
 * @param fertFirst The lowest active Fertilizer Id (start of linked list that is stored by nextFid).
 * @param fertLast The highest active Fertilizer Id (end of linked list that is stored by nextFid).
 * @param bpf The cumulative Beans Per Fertilizer (bfp) minted over all Season.
 * @param recapitalized The number of USDC that has been recapitalized in the Barn Raise.
 * @param _buffer Reserved storage for future expansion.
 */
struct Fertilizer {
    mapping(uint128 => uint256) fertilizer;
    mapping(uint128 => uint128) nextFid;
    uint256 activeFertilizer;
    uint256 fertilizedIndex;
    uint256 unfertilizedIndex;
    uint256 fertilizedPaidIndex;
    uint128 fertFirst;
    uint128 fertLast;
    uint128 bpf;
    uint256 recapitalized;
    bytes32[8] _buffer;
}

/**
 * @notice System-level Season state variables.
 * @param current The current Season in Beanstalk.
 * @param lastSop The Season in which the most recent consecutive series of Seasons of Plenty started.
 * @param withdrawSeasons The number of Seasons required to Withdraw a Deposit.
 * @param lastSopSeason The Season in which the most recent consecutive series of Seasons of Plenty ended.
 * @param rainStart Stores the most recent Season in which Rain started.
 * @param raining True if it is Raining (P > 1, Pod Rate Excessively Low).
 * @param fertilizing True if Beanstalk has Fertilizer left to be paid off.
 * @param sunriseBlock The block of the start of the current Season.
 * @param abovePeg Boolean indicating whether the previous Season was above or below peg.
 * @param stemStartSeason // season in which the stem storage method was introduced.
 * @param stemScaleSeason // season in which the stem v1.1 was introduced, where stems are not truncated anymore.
 * @param deprecated // beanEthStartMintingSeason - Season to start minting in Bean:Eth pool after migrating liquidity out of the pool to protect against Pump failure.
 * This allows for greater precision of stems, and requires a soft migration (see {LibTokenSilo.removeDepositFromAccount})
 * @param start The timestamp of the Beanstalk deployment rounded down to the nearest hour.
 * @param period The length of each season in Beanstalk in seconds.
 * @param timestamp The timestamp of the start of the current Season.
 * @param _buffer Reserved storage for future expansion.
 */
struct Season {
    uint32 current; // ─────────────────┐ 4
    uint32 lastSop; //                  │ 4 (8)
    uint8 withdrawSeasons; //           │ 1 (9)
    uint32 lastSopSeason; //            │ 4 (13)
    uint32 rainStart; //                │ 4 (17)
    bool raining; //                    │ 1 (18)
    bool fertilizing; //                │ 1 (19)
    uint32 sunriseBlock; //             │ 4 (23)
    bool abovePeg; //                   | 1 (24)
    uint16 stemStartSeason; //          | 2 (26)
    uint16 stemScaleSeason; //          | 2 (28/32)
    uint32 deprecated; //               ┘ 4 (32/32) beanEthStartMintingSeason - deprecated after Bean:wStEth migration completed.
    uint256 start;
    uint256 period;
    uint256 timestamp;
    bytes32[8] _buffer;
}

/**
 * @notice System-level Weather state variables.
 * @param lastDSoil Delta Soil; the number of Soil purchased last Season.
 * @param lastSowTime The number of seconds it for Soil to sell out last Season.
 * @param thisSowTime The number of seconds it for Soil to sell out this Season.
 * @param temp Temperature is max interest rate in current Season for sowing Beans in Soil. Adjusted each Season.
 * @param _buffer Reserved storage for future expansion.
 */
struct Weather {
    uint128 lastDSoil; // ───┐ 16 (16)
    uint32 lastSowTime; //    │ 4  (20)
    uint32 thisSowTime; //    │ 4  (24)
    uint32 temp; // ─────────────┘ 4  (28/32)
    bytes32[8] _buffer;
}

/**
 * @notice System level variables used in the seed Gauge
 * @param averageGrownStalkPerBdvPerSeason The average Grown Stalk Per BDV
 * that beanstalk issues each season.
 * @param beanToMaxLpGpPerBdvRatio a scalar of the gauge points(GP) per bdv
 * issued to the largest LP share and Bean. 6 decimal precision.
 * @param _buffer Reserved storage for future expansion.
 * @dev a beanToMaxLpGpPerBdvRatio of 0 means LP should be incentivized the most,
 * and that beans will have the minimum seeds ratio. see {LibGauge.getBeanToMaxLpGpPerBdvRatioScaled}
 */
struct SeedGauge {
    uint128 averageGrownStalkPerBdvPerSeason;
    uint128 beanToMaxLpGpPerBdvRatio;
    bytes32[8] _buffer;
}

/**
 * @notice System-level Rain balances. Rain occurs when P > 1 and the Pod Rate Excessively Low.
 * @param pods The number of Pods when it last started Raining.
 * @param roots The number of Roots when it last started Raining.
 * @param _buffer Reserved storage for future expansion.
 */
struct Rain {
    uint256 pods;
    uint256 roots;
    bytes32[8] _buffer;
}

/**
 * @notice System-level Silo state; contains deposit and withdrawal data for a particular whitelisted Token.
 * @param deposited The total amount of this Token currently Deposited in the Silo.
 * @param depositedBdv The total bdv of this Token currently Deposited in the Silo.
 * @dev {State} contains a mapping from Token address => AssetSilo.
 * Currently, the bdv of deposits are asynchronous, and require an on-chain transaction to update.
 * Thus, the total bdv of deposits cannot be calculated, and must be stored and updated upon a bdv change.
 */
struct AssetSilo {
    uint128 deposited;
    uint128 depositedBdv;
}

/**
 * @notice Whitelist Status a token that has been Whitelisted before.
 * @param token the address of the token.
 * @param isWhitelisted whether the address is whitelisted.
 * @param isWhitelistedLp whether the address is a whitelisted LP token.
 * @param isWhitelistedWell whether the address is a whitelisted Well token.
 */

struct WhitelistStatus {
    address token;
    bool isWhitelisted;
    bool isWhitelistedLp;
    bool isWhitelistedWell;
}

/**
     * @notice Describes the settings for each Token that is Whitelisted in the Silo.
     * @param selector The encoded BDV function selector for the token that pertains to 
     * an external view Beanstalk function with the following signature:
     * ```
     * function tokenToBdv(uint256 amount) external view returns (uint256);
     * ```
     * It is called by `LibTokenSilo` through the use of `delegatecall`
     * to calculate a token's BDV at the time of Deposit.
     * @param stalkEarnedPerSeason represents how much Stalk one BDV of the underlying deposited token
     * grows each season. In the past, this was represented by seeds. This is stored as 1e6, plus stalk is stored
     * as 1e10, so 1 legacy seed would be 1e6 * 1e10.
     * @param stalkIssuedPerBdv The Stalk Per BDV that the Silo grants in exchange for Depositing this Token.
     * previously called stalk.
     * @param milestoneSeason The last season in which the stalkEarnedPerSeason for this token was updated.
     * @param milestoneStem The cumulative amount of grown stalk per BDV for this token at the last stalkEarnedPerSeason update.
     * @param encodeType determine the encoding type of the selector.
     * a encodeType of 0x00 means the selector takes an input amount.
     * 0x01 means the selector takes an input amount and a token.
     * @param gpSelector The encoded gaugePoint function selector for the token that pertains to 
     * an external view Beanstalk function with the following signature:
     * ```
     * function gaugePoints(
     *  uint256 currentGaugePoints,
     *  uint256 optimalPercentDepositedBdv,
     *  uint256 percentOfDepositedBdv
     *  ) external view returns (uint256);
     * ```
     * @param lwSelector The encoded liquidityWeight function selector for the token that pertains to 
     * an external view Beanstalk function with the following signature `function liquidityWeight()`
     * @param optimalPercentDepositedBdv The target percentage of the total LP deposited BDV for this token. 6 decimal precision.
     * @param gaugePoints the amount of Gauge points this LP token has in the LP Gauge. Only used for LP whitelisted assets.
     * GaugePoints has 18 decimal point precision (1 Gauge point = 1e18).
     * @dev A Token is considered Whitelisted if there exists a non-zero {AssetSettings} selector.
     */
struct AssetSettings {
    bytes4 selector; // ────────────────────┐ 4
    uint32 stalkEarnedPerSeason; //         │ 4  (8)
    uint32 stalkIssuedPerBdv; //            │ 4  (12)
    uint32 milestoneSeason; //              │ 4  (16)
    int96 milestoneStem; //                 │ 12 (28)
    bytes1 encodeType; //                   │ 1  (29)
    int24 deltaStalkEarnedPerSeason; // ────┘ 3  (32)
    bytes4 gpSelector; //    ────────────────┐ 4
    bytes4 lwSelector; //                    │ 4  (8)
    uint128 gaugePoints; //                  │ 16 (24)
    uint64 optimalPercentDepositedBdv; //  ──┘ 8  (32)
}

/**
 * @notice Describes the settings for each Unripe Token in Beanstalk.
 * @param underlyingToken The address of the Token underlying the Unripe Token.
 * @param balanceOfUnderlying The number of Tokens underlying the Unripe Tokens (redemption pool).
 * @param merkleRoot The Merkle Root used to validate a claim of Unripe Tokens.
 * @dev An Unripe Token is a vesting Token that is redeemable for a a pro rata share
 * of the `balanceOfUnderlying`, subject to a penalty based on the percent of
 * Unfertilized Beans paid back.
 *
 * There were two Unripe Tokens added at Replant:
 *  - Unripe Bean, with its `underlyingToken` as BEAN;
 *  - Unripe LP, with its `underlyingToken` as BEAN:3CRV LP.
 *
 * Unripe Tokens are initially distributed through the use of a `merkleRoot`.
 *
 * The existence of a non-zero {UnripeSettings} implies that a Token is an Unripe Token.
 */
struct UnripeSettings {
    address underlyingToken;
    uint256 balanceOfUnderlying;
    bytes32 merkleRoot;
}

/**
 * @notice Stores the twaReserves for each well during the sunrise function.
 */
struct TwaReserves {
    uint128 reserve0;
    uint128 reserve1;
}

/**
 * @notice Stores the total germination amounts for each whitelisted token.
 */
struct Deposited {
    uint128 amount;
    uint128 bdv;
}

/**
 * @notice Stores the system level germination Silo data.
 */
struct GerminatingSilo {
    uint128 stalk;
    uint128 roots;
}

/**
 * @notice Germinate determines what germination struct to use.
 * @dev "odd" and "even" refers to the value of the season counter.
 * "Odd" germinations are used when the season is odd, and vice versa.
 */
enum GerminationSide {
    ODD,
    EVEN,
    NOT_GERMINATING
}
