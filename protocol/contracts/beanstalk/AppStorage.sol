// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Account
 * @author Publius
 * @notice Stores Farmer-level Beanstalk state.
 * @dev {Account.State} is the primary struct that is referenced from {System.State}.
 * All other structs in {Account} are referenced in {Account.State}. Each unique
 * Ethereum address is a Farmer.
 */
contract Account {
    /**
     * @notice Stores a Farmer's Plots and Pod allowances.
     * @param plots A Farmer's Plots. Maps from Plot index to Pod amount.
     * @param podAllowances An allowance mapping for Pods similar to that of the ERC-20 standard. Maps from spender address to allowance amount.
     */
    struct Field {
        mapping(uint256 => uint256) plots;
        mapping(address => uint256) podAllowances;
    }

    /**
     * @notice Stores a Farmer's Deposits and Seeds per Deposit.
     * @param deposits Unripe Bean/LP Deposits (previously Bean/LP Deposits).
     * @param depositSeeds BDV of Unripe LP Deposits / 4 (previously # of Seeds in corresponding LP Deposit).
     */
    struct AssetSilo {
        mapping(uint32 => uint256) deposits;
        mapping(uint32 => uint256) depositSeeds;
    }

    /**
     * @notice Represents a Deposit of a given Token in the Silo at a given Season.
     * @param amount The amount of Tokens in the Deposit.
     * @param bdv The Bean-denominated value of the total amount of Tokens in the Deposit.
     * @dev `amount` and `bdv` are packed as uint128 to save gas.
     */
    struct Deposit {
        uint128 amount; // ───┐ 16
        uint128 bdv; // ──────┘ 16 (32/32)
    }

    /**
     * @notice Stores a Farmer's Stalk and Seeds balances.
     * @param stalk Balance of the Farmer's Stalk.
     * @param seeds DEPRECATED – Balance of the Farmer's Seeds. Seeds are no longer referenced as of Silo V3.
     */
    struct Silo {
        uint256 stalk;
        uint256 seeds;
    }

    /**
     * @notice Stores a Farmer's germinating stalk.
     * @param odd - stalk from assets deposited in odd seasons.
     * @param even - stalk from assets deposited in even seasons.
     */
    struct FarmerGerminatingStalk {
        uint128 odd;
        uint128 even;
    }

    /**
     * @notice This struct stores the mow status for each Silo-able token, for each farmer.
     * This gets updated each time a farmer mows, or adds/removes deposits.
     * @param lastStem The last cumulative grown stalk per bdv index at which the farmer mowed.
     * @param bdv The bdv of all of a farmer's deposits of this token type.
     *
     */
    struct MowStatus {
        int96 lastStem; // ───┐ 12
        uint128 bdv; // ──────┘ 16 (28/32)
    }

    /**
     * @notice Stores a Farmer's Season of Plenty (SOP) balances.
     * @param roots The number of Roots a Farmer had when it started Raining.
     * @param plentyPerRoot The global Plenty Per Root index at the last time a Farmer updated their Silo.
     * @param plenty The balance of a Farmer's plenty. Plenty can be claimed directly for tokens.
     */
    struct SeasonOfPlenty {
        uint256 roots;
        uint256 plentyPerRoot;
        uint256 plenty;
    }

    /**
     * @notice Defines the state object for a Farmer.
     * @param field A Farmer's Field storage.
     * @param bean A Farmer's Unripe Bean Deposits only as a result of Replant (previously held the V1 Silo Deposits/Withdrawals for Beans).
     * @param lp A Farmer's Unripe LP Deposits as a result of Replant of BEAN:ETH Uniswap v2 LP Tokens (previously held the V1 Silo Deposits/Withdrawals for BEAN:ETH Uniswap v2 LP Tokens).
     * @param s A Farmer's Silo storage.
     * @param lastUpdate The Season in which the Farmer last updated their Silo.
     * @param lastSop The last Season that a SOP occured at the time the Farmer last updated their Silo.
     * @param lastRain The last Season that it started Raining at the time the Farmer last updated their Silo.
     * @param roots A Farmer's Root balance.
     * @param legacyV2Deposits DEPRECATED - SiloV2 was retired in favor of Silo V3. A Farmer's Silo Deposits stored as a map from Token address to Season of Deposit to Deposit.
     * @param withdrawals Withdraws were removed in zero withdraw upgrade - A Farmer's Withdrawals from the Silo stored as a map from Token address to Season the Withdrawal becomes Claimable to Withdrawn amount of Tokens.
     * @param sop A Farmer's Season of Plenty storage.
     * @param depositAllowances A mapping of `spender => Silo token address => amount`.
     * @param tokenAllowances Internal balance token allowances.
     * @param depositPermitNonces A Farmer's current deposit permit nonce
     * @param tokenPermitNonces A Farmer's current token permit nonce
     * @param legacyV3Deposits DEPRECATED: Silo V3 deposits. Deprecated in favor of SiloV3.1 mapping from depositId to Deposit.
     * @param mowStatuses A mapping of Silo-able token address to MowStatus.
     * @param isApprovedForAll A mapping of ERC1155 operator to approved status. ERC1155 compatability.
     * @param farmerGerminating A Farmer's germinating stalk. Seperated into odd and even stalk.
     * @param deposits SiloV3.1 deposits. A mapping from depositId to Deposit. SiloV3.1 introduces greater precision for deposits.
     */
    struct State {
        Field field; // A Farmer's Field storage.
        /*
         * @dev (Silo V1) A Farmer's Unripe Bean Deposits only as a result of Replant
         *
         * Previously held the V1 Silo Deposits/Withdrawals for Beans.

         * NOTE: While the Silo V1 format is now deprecated, this storage slot is used for gas
         * efficiency to store Unripe BEAN deposits. See {LibUnripeSilo} for more.
         */
        AssetSilo bean;
        /*
         * @dev (Silo V1) Unripe LP Deposits as a result of Replant.
         *
         * Previously held the V1 Silo Deposits/Withdrawals for BEAN:ETH Uniswap v2 LP Tokens.
         *
         * BEAN:3CRV and BEAN:LUSD tokens prior to Replant were stored in the Silo V2
         * format in the `s.accounts[account].legacyV2Deposits` mapping.
         *
         * NOTE: While the Silo V1 format is now deprecated, unmigrated Silo V1 deposits are still
         * stored in this storage slot. See {LibUnripeSilo} for more.
         *
         */
        AssetSilo lp;
        /*
         * @dev Holds Silo specific state for each account.
         */
        Silo silo;
        uint32 lastUpdate; // The Season in which the Farmer last updated their Silo.
        uint32 lastSop; // The last Season that a SOP occured at the time the Farmer last updated their Silo.
        uint32 lastRain; // The last Season that it started Raining at the time the Farmer last updated their Silo.
        uint256 roots; // A Farmer's Root balance.
        mapping(address => mapping(uint32 => Deposit)) legacyV2Deposits; // Legacy Silo V2 Deposits stored as a map from Token address to Season of Deposit to Deposit. NOTE: While the Silo V2 format is now deprecated, unmigrated Silo V2 deposits are still stored in this mapping.
        mapping(address => mapping(uint32 => uint256)) withdrawals; // Zero withdraw eliminates a need for withdraw mapping, but is kept for legacy
        SeasonOfPlenty sop; // A Farmer's Season Of Plenty storage.
        mapping(address => mapping(address => uint256)) depositAllowances; // Spender => Silo Token
        mapping(address => mapping(IERC20 => uint256)) tokenAllowances; // Token allowances
        uint256 depositPermitNonces; // A Farmer's current deposit permit nonce
        uint256 tokenPermitNonces; // A Farmer's current token permit nonce
        mapping(uint256 => Deposit) legacyV3Deposits; // NOTE: Legacy SiloV3 Deposits stored as a map from uint256 to Deposit. This is an concat of the token address and the CGSPBDV for a ERC20 deposit.
        mapping(address => MowStatus) mowStatuses; // Store a MowStatus for each Whitelisted Silo token
        mapping(address => bool) isApprovedForAll; // ERC1155 isApprovedForAll mapping
        // Germination
        FarmerGerminatingStalk farmerGerminating; // A Farmer's germinating stalk.
        // Silo v3.1
        mapping(uint256 => Deposit) deposits; // Silo v3.1 Deposits stored as a map from uint256 to Deposit. This is an concat of the token address and the stem for a ERC20 deposit.
    }
}

/**
 * @title System
 * @author Publius
 * @notice Stores system-level Beanstalk state.
 */
contract System {
    /**
     * @notice System-level Field state variables.
     * @param soil The number of Soil currently available. Adjusted during {Sun.stepSun}.
     * @param beanSown The number of Bean sown within the current Season. Reset during {Weather.calcCaseId}.
     * @param pods The pod index; the total number of Pods ever minted.
     * @param harvested The harvested index; the total number of Pods that have ever been Harvested.
     * @param harvestable The harvestable index; the total number of Pods that have ever been Harvestable. Included previously Harvested Beans.
     */
    struct Field {
        uint128 soil; // ──────┐ 16
        uint128 beanSown; // ──┘ 16 (32/32)
        uint256 pods;
        uint256 harvested;
        uint256 harvestable;
    }

    /**
     * @notice System-level Silo state; contains deposit and withdrawal data for a particular whitelisted Token.
     * @param deposited The total amount of this Token currently Deposited in the Silo.
     * @param depositedBdv The total bdv of this Token currently Deposited in the Silo.
     * @dev {System.State} contains a mapping from Token address => AssetSilo.
     * Currently, the bdv of deposits are asynchronous, and require an on-chain transaction to update.
     * Thus, the total bdv of deposits cannot be calculated, and must be stored and updated upon a bdv change.
     *
     *
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
     * @notice System-level Silo state variables.
     * @param stalk The total amount of active Stalk (including Earned Stalk, excluding Grown Stalk).
     * @dev seeds are no longer used internally. Balance is wiped to 0 from the mayflower update. see {mowAndMigrate}.
     * @param roots The total amount of Roots.
     */
    struct Silo {
        uint256 stalk;
        uint256 roots;
    }

    /**
     * @notice System-level Rain balances. Rain occurs when P > 1 and the Pod Rate Excessively Low.
     * @dev The `raining` storage variable is stored in the Season section for a gas efficient read operation.
     * @param pods The number of Pods when it last started Raining.
     * @param roots The number of Roots when it last started Raining.
     */
    struct Rain {
        uint256 pods;
        uint256 roots;
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
     * @param beanEthStartMintingSeason // Season to start minting in Bean:Eth pool after migrating liquidity out of the pool to protect against Pump failure.
     * This allows for greater precision of stems, and requires a soft migration (see {LibTokenSilo.removeDepositFromAccount})
     * @param start The timestamp of the Beanstalk deployment rounded down to the nearest hour.
     * @param period The length of each season in Beanstalk in seconds.
     * @param timestamp The timestamp of the start of the current Season.
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
        uint32 beanEthStartMintingSeason; //┘ 4 (32/32) NOTE: Reset and delete after Bean:wStEth migration has been completed.
        uint256 start;
        uint256 period;
        uint256 timestamp;
    }

    /**
     * @notice System-level Weather state variables.
     * @param lastDSoil Delta Soil; the number of Soil purchased last Season.
     * @param lastSowTime The number of seconds it for Soil to sell out last Season.
     * @param thisSowTime The number of seconds it for Soil to sell out this Season.
     * @param t The Temperature; the maximum interest rate during the current Season for sowing Beans in Soil. Adjusted each Season.
     */
    struct Weather {
        uint128 lastDSoil; // ───┐ 16 (16)
        uint32 lastSowTime; //    │ 4  (20)
        uint32 thisSowTime; //    │ 4  (24)
        uint32 t; // ─────────────┘ 4  (28/32)
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

     * @dev A Token is considered Whitelisted if there exists a non-zero {SiloSettings} selector.
     */
    struct SiloSettings {
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
     * @notice System level variables used in the seed Gauge System.
     * @param averageGrownStalkPerBdvPerSeason The average Grown Stalk Per BDV
     * that beanstalk issues each season.
     * @param beanToMaxLpGpPerBdvRatio a scalar of the gauge points(GP) per bdv
     * issued to the largest LP share and Bean. 6 decimal precision.
     * @dev a beanToMaxLpGpPerBdvRatio of 0 means LP should be incentivized the most,
     * and that beans will have the minimum seeds ratio. see {LibGauge.getBeanToMaxLpGpPerBdvRatioScaled}
     */
    struct SeedGauge {
        uint128 averageGrownStalkPerBdvPerSeason;
        uint128 beanToMaxLpGpPerBdvRatio;
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
     * @notice Stores the system level germination data.
     */
    struct TotalGerminating {
        mapping(address => Deposited) deposited;
    }

    struct GerminatingSilo {
        uint128 stalk;
        uint128 roots;
    }
}

/**
 * @title AppStorage
 * @author Publius
 * @notice Defines the state object for Beanstalk.
 * @param paused True if Beanstalk is Paused.
 * @param pausedAt The timestamp at which Beanstalk was last paused.
 * @param season System.Season
 * @param field System.Field
 * @param rain System.Rain
 * @param silo System.Silo
 * @param reentrantStatus An intra-transaction state variable to protect against reentrance.
 * @param weather System.Weather
 * @param earnedBeans The number of Beans distributed to the Silo that have not yet been Deposited as a result of the Earn function being called.
 * @param accounts mapping (address => Account.State)
 * @param podListings A mapping from Plot Index to the hash of the Pod Listing.
 * @param podOrders A mapping from the hash of a Pod Order to the amount of Pods that the Pod Order is still willing to buy.
 * @param siloBalances A mapping from Token address to Silo Balance storage (amount deposited and withdrawn).
 * @param siloSettings A mapping from Token address to Silo Settings for each Whitelisted Token. If a non-zero storage exists, a Token is whitelisted.
 * @param sops A mapping from Season to Plenty Per Root (PPR) in that Season. Plenty Per Root is 0 if a Season of Plenty did not occur.
 * @param internalTokenBalance A mapping from Farmer address to Token address to Internal Balance. It stores the amount of the Token that the Farmer has stored as an Internal Balance in Beanstalk.
 * @param unripeClaimed True if a Farmer has Claimed an Unripe Token. A mapping from Farmer to Unripe Token to its Claim status.
 * @param unripe Unripe Settings for a given Token address. The existence of a non-zero Unripe Settings implies that the token is an Unripe Token. The mapping is from Token address to Unripe Settings.
 * @param fertilizer A mapping from Fertilizer Id to the supply of Fertilizer for each Id.
 * @param nextFid A linked list of Fertilizer Ids ordered by Id number. Fertilizer Id is the Beans Per Fertilzer level at which the Fertilizer no longer receives Beans. Sort in order by which Fertilizer Id expires next.
 * @param activeFertilizer The number of active Fertilizer.
 * @param fertilizedIndex The total number of Fertilizer Beans.
 * @param unfertilizedIndex The total number of Unfertilized Beans ever.
 * @param fertFirst The lowest active Fertilizer Id (start of linked list that is stored by nextFid).
 * @param fertLast The highest active Fertilizer Id (end of linked list that is stored by nextFid).
 * @param bpf The cumulative Beans Per Fertilizer (bfp) minted over all Season.
 * @param recapitalized The number of USDC that has been recapitalized in the Barn Raise.
 * @param isFarm Stores whether the function is wrapped in the `farm` function (1 if not, 2 if it is).
 * @param ownerCandidate Stores a candidate address to transfer ownership to. The owner must claim the ownership transfer.
 * @param wellOracleSnapshots A mapping from Well Oracle address to the Well Oracle Snapshot.
 * @param migratedBdvs Stores the total migrated BDV since the implementation of the migrated BDV counter. See {LibLegacyTokenSilo.incrementMigratedBdv} for more info.
 * @param twaReserves A mapping from well to its twaReserves. Stores twaReserves during the sunrise function. Returns 1 otherwise for each asset. Currently supports 2 token wells.
 * @param usdTokenPrice A mapping from token address to usd price.
 * @param seedGauge Stores the seedGauge.
 * @param casesV2 Stores the 144 Weather and seedGauge cases.
 * @param oddGerminating Stores germinating data during odd seasons.
 * @param evenGerminating Stores germinating data during even seasons.
 * @param unclaimedGerminating A mapping from season to object containing the stalk and roots that are germinating.
 * @param whitelistStatuses Stores a list of Whitelist Statues for all tokens that have been Whitelisted and have not had their Whitelist Status manually removed.
 * @param sopWell Stores the well that will be used upon a SOP. Unintialized until a SOP occurs, and is kept constant afterwards.
 * @param internalTokenBalanceTotal Sum of all users internalTokenBalance.
 * @param fertilizedPaidIndex The total number of Fertilizer Beans that have been sent out to users.
 * @param plenty The amount of plenty token held by the contract.
 */
struct AppStorage {
    bool paused; // ────────┐ 1
    uint128 pausedAt; // ───┘ 16 (17/32)
    System.Season season;
    System.Field field;
    System.Rain rain;
    System.Silo silo;
    uint256 reentrantStatus;
    System.Weather weather;
    uint256 earnedBeans;
    mapping(address => Account.State) accounts;
    mapping(uint256 => bytes32) podListings;
    mapping(bytes32 => uint256) podOrders;
    mapping(address => System.AssetSilo) siloBalances;
    mapping(address => System.SiloSettings) siloSettings;
    mapping(uint32 => uint256) sops;
    // Internal Balances
    mapping(address => mapping(IERC20 => uint256)) internalTokenBalance;
    // Unripe
    mapping(address => mapping(address => bool)) unripeClaimed;
    mapping(address => System.UnripeSettings) unripe;
    // Fertilizer
    mapping(uint128 => uint256) fertilizer;
    mapping(uint128 => uint128) nextFid;
    uint256 activeFertilizer;
    uint256 fertilizedIndex;
    uint256 unfertilizedIndex;
    uint128 fertFirst;
    uint128 fertLast;
    uint128 bpf;
    uint256 recapitalized;
    // Farm
    uint256 isFarm;
    // Ownership
    address ownerCandidate;
    // Well
    mapping(address => bytes) wellOracleSnapshots;
    // Silo V3 BDV Migration
    mapping(address => uint256) migratedBdvs;
    // Well + USD Price Oracle
    mapping(address => System.TwaReserves) twaReserves;
    mapping(address => uint256) usdTokenPrice;
    // Seed Gauge
    System.SeedGauge seedGauge;
    bytes32[144] casesV2;
    // Germination
    System.TotalGerminating oddGerminating;
    System.TotalGerminating evenGerminating;
    mapping(uint32 => System.GerminatingSilo) unclaimedGerminating;
    System.WhitelistStatus[] whitelistStatuses;
    address sopWell;
    // Cumulative internal Balance of tokens.
    mapping(IERC20 => uint256) internalTokenBalanceTotal;
    uint256 fertilizedPaidIndex;
    uint256 plenty;
}
